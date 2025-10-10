import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { realtime } from "@/lib/realtime";
import api from "@/lib/axios";
import type { JourneyItem } from "@/types/journey";
import { createGroupSession, createIndividualSession, commandSession, type SessionType } from "@/lib/sessions";
import ProgressStepper from "./components/ProgressStepper";
import SessionTypeStep from "./components/steps/SessionTypeStep";
import DeviceSelectionStep from "./components/steps/DeviceSelectionStep";
import JourneySelectionStep from "./components/steps/JourneySelectionStep";
import ControllerStep from "./components/steps/ControllerStep";

type DeviceType = "vr" | "chair" | "unknown";

type Device = {
  id: string;
  type: DeviceType;
  name: string;
  online: boolean;
  lastSeen?: number;
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
  const [mqttUrl] = useState<string>("http://localhost:8001");
  const [forceBridge] = useState<boolean>(true);
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
  const [hasOngoingSession, setHasOngoingSession] = useState<boolean>(false);

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
          const jids: number[] = Array.isArray(s.journey_ids) ? s.journey_ids! : [];
          const participants: ParticipantRec[] = Array.isArray(s.participants) ? s.participants! : [];
          const seededPairs = participants
            .filter((m) => m.vr_device_id && m.chair_device_id)
            .map((m) => ({ sessionId: sid, vrId: String(m.vr_device_id), chairId: String(m.chair_device_id), journeyId: jids }));
          if (seededPairs.length > 0) {
            setPairs(seededPairs);
            setActiveSessionId(sid);
            setSelectedJourneyIds(jids.map((x) => String(x)));
            setSessionType((s.session_type as SessionType) || null);
            setHasOngoingSession(true);
            // Ensure journeys are populated when jumping straight into controller
            void loadJourneys();
            setCurrentStep("controller");
          }
        } else {
          setHasOngoingSession(false);
        }
      } catch {
        // ignore fetch errors; remain in flow
        setHasOngoingSession(false);
      }
    };
    void loadOngoing();
  }, [loadJourneys]);

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

  const handleMessage = useCallback(
    (msg: { destinationName: string; payloadString?: string }) => {
      const t = msg.destinationName;
      const p = msg.payloadString || "";
      try {
        if (t === "devices/discovery/announce") {
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
          const id = t.split("/")[1];
          const data = JSON.parse(p || "{}");
          renderDevices((map) => {
            const cur: Device = map.get(id) || { id, type: "unknown", name: id, online: false };
            const status = String((data && data.status) || "").toLowerCase();
            cur.online = ["active", "idle", "online"].includes(status);
            cur.lastSeen = Date.now();
            map.set(id, cur);
            return map;
          });
        } else if (t.startsWith("devices/") && t.endsWith("/heartbeat")) {
          const id = t.split("/")[1];
          renderDevices((map) => {
            const cur: Device = map.get(id) || { id, type: "unknown", name: id, online: false };
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
    (sessionId: string, type: "play" | "pause" | "seek" | "stop", positionMs?: number) => {
      const p = pairs.find((x) => x.sessionId === sessionId);
      if (!p) {
        alert("Session not found");
        return;
      }
      if (sessionId) {
        const cmd = type === "play" ? "start" : (type as "pause" | "seek" | "stop");
        void commandSession(sessionId, cmd, { positionMs: Number(positionMs || 0) });
        return;
      }
      const payload = {
        positionMs: Number(positionMs || 0),
        journeyId: p.journeyId || null,
        timestamp: new Date().toISOString(),
      };
      publishTopic(`devices/${p.vrId}/commands/${type}`, JSON.stringify(payload), false);
      publishTopic(`devices/${p.chairId}/commands/${type}`, JSON.stringify(payload), false);
    },
    [pairs, publishTopic],
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
      const only = pairs[0];
      if (!only || !selectedJourneyIds) return;
      const rec = await createIndividualSession({
        session_type: "individual",
        vrDeviceId: only.vrId,
        chairDeviceId: only.chairId,
        journeyId: selectedJourneyIds.map((id) => Number(id)),
      });
      setPairs((prev) =>
        prev.map((p, i) =>
          i === 0 ? { ...p, sessionId: rec.id, journeyId: selectedJourneyIds.map((id) => Number(id)) } : p,
        ),
      );
      setActiveSessionId(rec.id);
      setCurrentStep("controller");
      log(`Individual session created: ${rec.id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log(`Create session failed: ${message}`);
    }
  }, [pairs, selectedJourneyIds, log]);

  const handleCreateGroup = useCallback(async () => {
    try {
      if (pairs.length === 0 || !selectedJourneyIds) return;
      console.log(selectedJourneyIds);
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
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log(`Create group failed: ${message}`);
    }
  }, [pairs, selectedJourneyIds, log]);

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
                void loadJourneys();
                setSelectedJourneyIds([]);
                setCurrentStep("journey-selection");
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
              setSelectedJourneyIds={(updater) => setSelectedJourneyIds((prev) => updater(prev))}
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
              onNewSession={resetFlow}
              pairs={pairs}
              onlineById={onlineById}
              lockToExistingSession={hasOngoingSession}
              sessionType={sessionType}
            />
          )}
        </div>
      </div>
    </div>
  );
}
