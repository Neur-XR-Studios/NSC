import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { realtime } from "@/lib/realtime";
import api from "@/lib/axios";
import type { JourneyItem } from "@/types/journey";
import { createGroupSession, createIndividualSession, commandSession, addParticipant, getSessionById, type SessionType } from "@/lib/sessions";
import ProgressStepper from "./components/ProgressStepper";
import SessionTypeStep from "./components/steps/SessionTypeStep";
import JourneySelectionStep from "./components/steps/JourneySelectionStep";
import DeviceSelectionStep from "./components/steps/DeviceSelectionStep";
import ControllerStep from "./components/steps/ControllerStep";

type DeviceType = "vr" | "chair" | "unknown";

type Device = {
  id: string;
  type: DeviceType;
  name: string;
  online: boolean;
  lastSeen?: number;
  status?: string;
  positionMs?: number;
  sessionId?: string;
  currentJourneyId?: number;
  lastEvent?: string;
  lastEventTimestamp?: string;
};

type Pair = {
  sessionId: string;
  vrId: string;
  chairId: string;
  journeyId?: number[];
};

type Mode = "mqtt" | "bridge";

type FlowStep = "session-type" | "device-selection" | "journey-selection" | "controller";

// Types for Retrieve Session API (minimal fields used)
interface ParticipantRec {
  vr_device_id?: string | null;
  chair_device_id?: string | null;
}
interface SessionRec {
  id: string;
  session_type?: SessionType;
  journey_ids?: number[];
  participants?: ParticipantRec[];
}
interface SessionsEnvelope {
  data?: {
    data?: SessionRec[];
    total?: number;
    page?: number;
    limit?: number;
  };
}

export default function DeviceControlPanel() {
  // Connection form state
  // Use explicit backend URL for bridge (Socket.IO). Default to localhost:8001 during dev.
  const backendUrl = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:8001';
  const mqttWsUrl = (import.meta.env.VITE_MQTT_WS_URL as string) || 'ws://localhost:9001';
  const [forceBridge] = useState<boolean>(true);
  const [mqttUrl] = useState<string>(forceBridge ? backendUrl : mqttWsUrl);
  const [clientId] = useState<string>(`admin-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  const [username] = useState<string>("admin@example.com");
  const [password] = useState<string>("Admin@123");

  // Journeys
  const [journeys, setJourneys] = useState<JourneyItem[]>([]);
  const [journeysLoading, setJourneysLoading] = useState<boolean>(false);

  // Connection
  const [connected, setConnected] = useState<boolean>(false);
  const [mode, setMode] = useState<Mode>("mqtt");

  // Devices & pairs
  const [devicesMap, setDevicesMap] = useState<Map<string, Device>>(new Map());
  const devicesList = useMemo(() => Array.from(devicesMap.values()), [devicesMap]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const vrDevices = useMemo(() => devicesList.filter((d) => d.type === "vr" && d.online), [devicesList]);
  const chairDevices = useMemo(() => devicesList.filter((d) => d.type === "chair" && d.online), [devicesList]);
  const pairedVrIds = useMemo(() => new Set(pairs.map((p) => p.vrId)), [pairs]);
  const pairedChairIds = useMemo(() => new Set(pairs.map((p) => p.chairId)), [pairs]);
  const [selectedVrId, setSelectedVrId] = useState<string>("");
  const [selectedChairId, setSelectedChairId] = useState<string>("");
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const activePair = useMemo(
    () => pairs.find((p) => p.sessionId === activeSessionId) || null,
    [pairs, activeSessionId],
  );
  const [seekValues, setSeekValues] = useState<Record<string, number>>({});
  const [currentStep, setCurrentStep] = useState<FlowStep>("session-type");
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [selectedJourneyIds, setSelectedJourneyIds] = useState<string[]>([]);

  // Logs
  const [logs, setLogs] = useState<string[]>([]);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${msg}`].slice(-1000));
  }, []);

  // Journeys loader (used by selection and when auto-locking into controller)
  const loadJourneys = useCallback(async () => {
    try {
      setJourneysLoading(true);
      const res = await api.get<{ total?: number; page?: number; limit?: number; data?: { data: JourneyItem[] } }>(
        "journeys",
        { page: 1, limit: 24 },
      );
      const list = (res?.data?.data as unknown as JourneyItem[]) || res?.data?.data || [];
      setJourneys(list);
      log(`Journeys loaded: ${(list || []).length}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log(`Journey load failed: ${message}`);
    } finally {
      setJourneysLoading(false);
    }
  }, [log]);

  // Load ongoing sessions on initial mount to lock into controller if needed
  useEffect(() => {
    const loadOngoing = async () => {
      try {
        const res = await api.get<SessionsEnvelope | { data?: SessionRec[] }>("sessions", { status: "on_going" });
        const root = res?.data as SessionsEnvelope | { data?: SessionRec[] } | undefined;
        const list: SessionRec[] = Array.isArray((root as { data?: SessionRec[] })?.data)
          ? ((root as { data?: SessionRec[] }).data || [])
          : ((root as SessionsEnvelope)?.data?.data || []);
        if (Array.isArray(list) && list.length > 0) {
          const s: SessionRec = list[0]!;
          const sid: string = s.id;
          let jids: number[] = Array.isArray(s.journey_ids) ? s.journey_ids! : [];
          let participants: ParticipantRec[] = Array.isArray(s.participants) ? s.participants! : [];
          // If participants are missing in list payload, fetch session details (fallback)
          if (!participants || participants.length === 0) {
            try {
              const det = await getSessionById(sid);
              jids = Array.isArray(det?.data?.journey_ids) ? (det!.data!.journey_ids as number[]) : jids;
              participants = Array.isArray(det?.data?.participants) ? (det!.data!.participants as ParticipantRec[]) : [];
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              log(`Fallback session details load failed: ${message}`);
            }
          }
          const seededPairs = (participants || [])
            .filter((m) => m.vr_device_id && m.chair_device_id)
            .map((m) => ({ sessionId: sid, vrId: String(m.vr_device_id), chairId: String(m.chair_device_id), journeyId: jids }));
          if (seededPairs.length > 0) {
            setPairs(seededPairs);
            setActiveSessionId(sid);
            setSelectedJourneyIds(jids.map((x) => String(x)));
            setSessionType((s.session_type as SessionType) || null);
            // Ensure journeys are populated when jumping straight into controller
            void loadJourneys();
            setCurrentStep("controller");
          }
        }
      } catch {
        // ignore fetch errors; remain in flow
      }
    };
    void loadOngoing();
  }, [loadJourneys, log]);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);


  const renderDevices = useCallback((updater: (prev: Map<string, Device>) => Map<string, Device>) => {
    setDevicesMap((prev) => {
      const next = new Map(prev);
      return updater(next);
    });
  }, []);

  const subscribeTopic = useCallback(
    (topic: string) => {
      if (!connected) return;
      realtime.subscribe(topic, 1);
      log(`${realtime.currentMode === "bridge" ? "Sub (bridge)" : "Sub"} ${topic}`);
    },
    [connected, log],
  );

  const publishTopic = useCallback(
    (topic: string, payload: string, retain = false) => {
      if (!connected) return;
      realtime.publish(topic, payload, retain, 1);
      log(`${realtime.currentMode === "bridge" ? "Pub (bridge)" : "Pub"} ${topic} ${payload}`);
    },
    [connected, log],
  );

  // Broadcast helper: instruct paired devices to join session via device-specific command
  const broadcastSessionJoin = useCallback(
    (sid: string, targetPairs: Pair[]) => {
      try {
        const ts = new Date().toISOString();
        for (const p of targetPairs) {
          const payload = {
            sessionId: sid,
            journeyId: p.journeyId || [],
            timestamp: ts,
          };
          publishTopic(`devices/${p.vrId}/commands/join_session`, JSON.stringify(payload), false);
          publishTopic(`devices/${p.chairId}/commands/join_session`, JSON.stringify(payload), false);
        }
        log(`Broadcasted join_session to ${targetPairs.length * 2} devices for session ${sid}`);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        log(`Broadcast failed: ${message}`);
      }
    },
    [publishTopic, log],
  );

  // When landing in controller (including ongoing sessions), ensure devices have the session id
  useEffect(() => {
    if (currentStep !== "controller" || !activeSessionId) return;
    const targets = pairs.filter((p) => p.sessionId === activeSessionId);
    if (targets.length > 0) {
      broadcastSessionJoin(activeSessionId, targets);
    }
  }, [currentStep, activeSessionId, pairs, broadcastSessionJoin]);

  const handleMessage = useCallback(
    (msg: { destinationName: string; payloadString?: string }) => {
      const t = msg.destinationName;
      const p = msg.payloadString || "";
      console.log("Message received: ", t, p);
      try {
        if (t === "devices/discovery/announce") {
          console.log("Announcement received for device: ", t.split("/")[1]);
          const d = JSON.parse(p || "{}");
          const id = d.deviceId;
          if (!id) return;
          renderDevices((map) => {
            const cur: Device = map.get(id) || {
              id,
              type: (d.type as DeviceType) || "unknown",
              name: d.name || id,
              online: false,
            };
            cur.type = (d.type as DeviceType) || cur.type;
            cur.name = d.name || cur.name;
            cur.lastSeen = Date.now();
            map.set(id, cur);
            return map;
          });
        } else if (t.startsWith("devices/") && t.endsWith("/status")) {
          console.log("Status received for device: ", t.split("/")[1]);
          const id = t.split("/")[1];
          const data = JSON.parse(p || "{}");
          renderDevices((map) => {
            const cur: Device = map.get(id) || { id, type: "unknown", name: id, online: false };
            const status = String((data && data.status) || "").toLowerCase();
            cur.online = ["active", "idle", "online", "connecting"].includes(status);
            cur.status = status || cur.status;
            // Update device type from status payload if provided
            const reportedType = String((data && data.type) || "").toLowerCase();
            if (reportedType === "vr" || reportedType === "chair") {
              cur.type = reportedType as DeviceType;
            } else if (cur.type === "unknown") {
              // Fallback: infer from deviceId prefix
              if (/^vr[_-]?/i.test(id)) cur.type = "vr";
              else if (/^chair[_-]?/i.test(id)) cur.type = "chair";
            }
            if (typeof data?.positionMs === "number") cur.positionMs = Number(data.positionMs);
            if (typeof data?.sessionId === "string") cur.sessionId = String(data.sessionId);
            cur.lastSeen = Date.now();
            map.set(id, cur);
            return map;
          });
        } else if (t.startsWith("devices/") && t.endsWith("/heartbeat")) {
          console.log("Heartbeat received for device: ", t.split("/")[1]);
          const id = t.split("/")[1];
          renderDevices((map) => {
            const cur: Device = map.get(id) || { id, type: "unknown", name: id, online: false };
            cur.lastSeen = Date.now();
            map.set(id, cur);
            return map;
          });
        } else if (t.startsWith("devices/") && t.endsWith("/events")) {
          console.log(p, t);
          const id = t.split("/")[1];
          const data = JSON.parse(p || "{}");
          const event = String(data?.event || "");
          log(`[Device Event] ${id}: ${event} (journey: ${data?.journeyId || "?"}, pos: ${data?.positionMs || 0}ms)`);
          renderDevices((map) => {
            const cur: Device = map.get(id) || { id, type: "unknown", name: id, online: false };
            if (event === "select_journey" && data?.journeyId != null) {
              cur.currentJourneyId = Number(data.journeyId);
            }
            if (event === "play") {
              cur.status = "active";
            } else if (event === "pause" || event === "stop") {
              cur.status = "idle";
            }
            if (typeof data?.positionMs === "number") cur.positionMs = Number(data.positionMs);
            if (typeof data?.sessionId === "string") cur.sessionId = String(data.sessionId);
            cur.lastEvent = event;
            cur.lastEventTimestamp = String(data?.timestamp || "");
            cur.lastSeen = Date.now();
            map.set(id, cur);
            return map;
          });
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        log(`Parse error: ${message}`);
      }
    },
    [log, renderDevices],
  );

  const connectBroker = useCallback(async () => {
    if (connected) return;
    try {
      await realtime.connect({ url: mqttUrl.trim(), clientId, username, password, forceBridge });
      setMode(realtime.currentMode);
      setConnected(true);
      log(`${realtime.currentMode === "bridge" ? "Bridge connected to" : "Connected to"} ${mqttUrl}`);

      const offMsg = realtime.onMessage((msg) => handleMessage(msg));
      const offConn = realtime.onConnect(() => setConnected(true));
      const offDisc = realtime.onDisconnect(() => setConnected(false));

      subscribeTopic("devices/discovery/announce");
      subscribeTopic("devices/+/status");
      subscribeTopic("devices/+/heartbeat");
      subscribeTopic("devices/+/events");

      const offs: Array<() => void> = [offConn, offDisc];
      if (realtime.currentMode === "bridge") {
        realtime.emitBridge("devices:get");
        offs.push(
          realtime.onBridge("devices:snapshot", (payload: unknown) => {
            try {
              if (Array.isArray(payload)) {
                renderDevices((map) => {
                  const next = new Map(map);
                  (payload as Array<Record<string, unknown>>).forEach((d) => {
                    if (!d?.deviceId) return;
                    next.set(d.deviceId as string, {
                      id: d.deviceId as string,
                      type: (d.type as DeviceType) || "unknown",
                      name: (d.name as string) || (d.deviceId as string),
                      online: true,
                      lastSeen: Date.now(),
                    });
                  });
                  return next;
                });
              }
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              log(`snapshot error: ${message}`);
            }
          }),
        );
        offs.push(
          realtime.onBridge("device:discovered", (d: unknown) => {
            const data = d as { deviceId?: string; type?: DeviceType; name?: string };
            if (!data?.deviceId) return;
            renderDevices((map) => {
              const cur: Device = map.get(data.deviceId!) || {
                id: data.deviceId!,
                type: "unknown",
                name: data.deviceId!,
                online: false,
              };
              cur.type = (data.type as DeviceType) || cur.type;
              cur.name = data.name || cur.name;
              cur.online = true;
              cur.lastSeen = Date.now();
              map.set(data.deviceId!, cur);
              return map;
            });
          }),
        );
        offs.push(
          realtime.onBridge("device:heartbeat", (h: unknown) => {
            const id = (h as { deviceId?: string })?.deviceId;
            if (!id) return;
            renderDevices((map) => {
              const cur: Device = map.get(id) || { id, type: "unknown", name: id, online: false };
              cur.online = true;
              cur.lastSeen = Date.now();
              map.set(id, cur);
              return map;
            });
          }),
        );
        offs.push(
          realtime.onBridge("device:status", (s: unknown) => {
            const id = (s as { deviceId?: string })?.deviceId;
            if (!id) return;
            renderDevices((map) => {
              const cur: Device = map.get(id) || { id, type: "unknown", name: id, online: false };
              cur.online = true;
              cur.lastSeen = Date.now();
              map.set(id, cur);
              return map;
            });
          }),
        );
        offs.push(
          realtime.onBridge("device:offline", (d: unknown) => {
            const id = (d as { deviceId?: string; type?: DeviceType })?.deviceId;
            if (!id) return;
            renderDevices((map) => {
              const cur: Device = map.get(id) || {
                id,
                type: ((d as { type?: DeviceType })?.type as DeviceType) || "unknown",
                name: id,
                online: false,
              };
              cur.online = false;
              map.set(id, cur);
              return map;
            });
          }),
        );
      }

      (window as unknown as { __realtimeOffs?: Array<() => void> }).__realtimeOffs = [offMsg, ...offs];
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log(`Connect error: ${message}`);
    }
  }, [
    clientId,
    forceBridge,
    handleMessage,
    log,
    mqttUrl,
    password,
    subscribeTopic,
    username,
    connected,
    renderDevices,
  ]);

  useEffect(() => {
    void connectBroker();
    return () => {
      try {
        realtime.disconnect();
      } catch (e) {
        void e;
      }
      const offs = (window as unknown as { __realtimeOffs?: Array<() => void> }).__realtimeOffs || [];
      offs.forEach((off) => typeof off === "function" && off());
      (window as unknown as { __realtimeOffs?: Array<() => void> }).__realtimeOffs = [];
      setConnected(false);
    };
  }, []);

  

  const sendCmd = useCallback(
    (sessionId: string, type: "play" | "pause" | "seek" | "stop", positionMs?: number, journeyId?: number) => {
      const p = pairs.find((x) => x.sessionId === sessionId);
      if (!p) {
        alert("Session not found");
        return;
      }
      if (sessionId) {
        const cmd = type === "play" ? "start" : (type as "pause" | "seek" | "stop");
        void commandSession(sessionId, cmd, { positionMs: Number(positionMs || 0), journeyId });
        return;
      }
      const payload = {
        positionMs: Number(positionMs || 0),
        journeyId: journeyId || p.journeyId || null,
        timestamp: new Date().toISOString(),
      };
      publishTopic(`devices/${p.vrId}/commands/${type}`, JSON.stringify(payload), false);
      publishTopic(`devices/${p.chairId}/commands/${type}`, JSON.stringify(payload), false);
    },
    [pairs, publishTopic],
  );

  // Participant-scoped device command (used for Individual flow without participantId)
  const sendParticipantCmd = useCallback(
    (pair: { vrId: string; chairId: string }, type: "play" | "pause" | "seek" | "stop", positionMs?: number) => {
      const payload = {
        positionMs: Number(positionMs || 0),
        timestamp: new Date().toISOString(),
      };
      publishTopic(`devices/${pair.vrId}/commands/${type}`, JSON.stringify(payload), false);
      publishTopic(`devices/${pair.chairId}/commands/${type}`, JSON.stringify(payload), false);
    },
    [publishTopic],
  );

  const resetFlow = useCallback(() => {
    setSelectedVrId("");
    setSelectedChairId("");
    setActiveSessionId("");
    setPairs([]);
    setSelectedJourneyIds([]);
    setSessionType(null);
    setCurrentStep("session-type");
  }, []);

  // const selectedVr = useMemo(() => vrDevices.find((d) => d.id === selectedVrId), [vrDevices, selectedVrId]);
  // const selectedChair = useMemo(
  //   () => chairDevices.find((d) => d.id === selectedChairId),
  //   [chairDevices, selectedChairId],
  // );

  const handleCreateIndividual = useCallback(async () => {
    try {
      const first = pairs[0];
      if (!first) return;
      // Create base individual session with the first pair; journeys optional/omitted
      const rec = await createIndividualSession({
        session_type: "individual",
        vrDeviceId: first.vrId,
        chairDeviceId: first.chairId,
      });
      const sid = rec.id;
      // Attach remaining pairs as participants
      for (let i = 1; i < pairs.length; i++) {
        const p = pairs[i]!;
        try {
          await addParticipant(sid, { vrDeviceId: p.vrId, chairDeviceId: p.chairId });
        } catch (e) {
          void e;
        }
      }
      // Update local pairs with session id
      setPairs((prev) => prev.map((p) => ({ ...p, sessionId: sid })));
      setActiveSessionId(sid);
      setCurrentStep("controller");
      // Ensure journeys are loaded for Individual mode (chips list uses all journeys)
      void loadJourneys();
      log(`Individual session created: ${sid} with ${pairs.length} pair(s)`);
      // Instruct all paired devices to join this session
      broadcastSessionJoin(sid, pairs.map((p) => ({ ...p, sessionId: sid })));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log(`Create session failed: ${message}`);
    }
  }, [pairs, log, broadcastSessionJoin, loadJourneys]);

  const handleCreateGroup = useCallback(async () => {
    try {
      if (pairs.length === 0 || !selectedJourneyIds) return;
      
      const payloadMembers = pairs.map((p) => ({ vrDeviceId: p.vrId, chairDeviceId: p.chairId, language: "en" }));
      const res = await createGroupSession({
        session_type: "group",
        members: payloadMembers,
        journeyIds: selectedJourneyIds.map((id) => parseInt(id)),
      });
      const sid = res.session.id;
      setPairs((prev) =>
        prev.map((p) => ({ ...p, sessionId: sid, journeyId: selectedJourneyIds.map((id) => parseInt(id)) })),
      );
      setActiveSessionId(sid);
      setCurrentStep("controller");
      log(`Group session created: ${sid} (group: ${res.groupId})`);
      // After creation, instruct all paired devices to join this session
      const enriched = pairs.map((p) => ({
        ...p,
        sessionId: sid,
        journeyId: selectedJourneyIds.map((id) => parseInt(id)),
      }));
      broadcastSessionJoin(sid, enriched);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log(`Create group failed: ${message}`);
    }
  }, [pairs, selectedJourneyIds, log, broadcastSessionJoin]);

  const getStepNumber = (step: FlowStep) => {
    const steps: FlowStep[] = ["session-type", "device-selection", "journey-selection", "controller"];
    return steps.indexOf(step);
  };

  const currentStepNumber = getStepNumber(currentStep);
  const onlineById = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const d of devicesList) map[d.id] = !!d.online;
    return map;
  }, [devicesList]);

  const deviceInfoById = useMemo(() => {
    const map: Record<string, { status?: string; positionMs?: number; sessionId?: string; currentJourneyId?: number; lastEvent?: string }> = {};
    for (const d of devicesList) {
      map[d.id] = { status: d.status, positionMs: d.positionMs, sessionId: d.sessionId, currentJourneyId: d.currentJourneyId, lastEvent: d.lastEvent };
    }
    return map;
  }, [devicesList]);

  return (
    <div className="">
      <div className="container">
        {/* Progress Stepper */}
        <ProgressStepper currentStepNumber={currentStepNumber} connected={connected} mode={mode} />

        {/* Main Content */}
        <div className="space-y-6">
          {/* Step 1: Session Type Selection */}
          {currentStep === "session-type" && (
            <SessionTypeStep
              onSelect={(type) => {
                setSessionType(type);
                setPairs([]);
                setSelectedVrId("");
                setSelectedChairId("");
                setSelectedJourneyIds([]);
                setActiveSessionId("");
                setCurrentStep("device-selection");
              }}
            />
          )}

          {/* Step 2: Device Selection */}
          {currentStep === "device-selection" && (
            <DeviceSelectionStep
              sessionType={sessionType}
              vrDevices={vrDevices}
              chairDevices={chairDevices}
              pairedVrIds={pairedVrIds}
              pairedChairIds={pairedChairIds}
              selectedVrId={selectedVrId}
              selectedChairId={selectedChairId}
              setSelectedVrId={setSelectedVrId}
              setSelectedChairId={setSelectedChairId}
              pairs={pairs}
              setPairs={(updater) => setPairs((prev) => updater(prev))}
              onBack={resetFlow}
              onContinue={() => {
                if (sessionType === "individual") {
                  void handleCreateIndividual();
                } else {
                  void loadJourneys();
                  setSelectedJourneyIds([]);
                  setCurrentStep("journey-selection");
                }
              }}
            />
          )}

          {/* Step 3: Journey Selection */}
          {currentStep === "journey-selection" && (
            <JourneySelectionStep
              journeys={journeys}
              journeysLoading={journeysLoading}
              onRefresh={() => void loadJourneys()}
              onBack={() => setCurrentStep("device-selection")}
              sessionType={sessionType}
              selectedJourneyIds={selectedJourneyIds}
              setSelectedJourneyIds={(updater: (prev: string[]) => string[]) => setSelectedJourneyIds((prev) => updater(prev))}
              onCreateIndividual={() => void handleCreateIndividual()}
              onCreateGroup={() => void handleCreateGroup()}
            />
          )}

          {/* Step 4: Controller */}
          {currentStep === "controller" && activePair && (
            <ControllerStep
              activePair={activePair}
              journeys={journeys}
              seekValues={seekValues}
              setSeekValues={(updater) => setSeekValues((prev) => updater(prev))}
              sendCmd={sendCmd}
              sendParticipantCmd={sendParticipantCmd}
              onNewSession={resetFlow}
              onResendSession={() => {
                const targets = pairs.filter((p) => p.sessionId === activeSessionId);
                if (activeSessionId && targets.length) broadcastSessionJoin(activeSessionId, targets);
              }}
              pairs={pairs}
              setPairs={(updater) => setPairs((prev) => updater(prev))}
              onlineById={onlineById}
              deviceInfoById={deviceInfoById}
              vrDevices={vrDevices}
              chairDevices={chairDevices}
              sessionType={sessionType}
            />
          )}
        </div>
      </div>
    </div>
  );
}
