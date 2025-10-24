import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { realtime } from "@/lib/realtime";
import api from "@/lib/axios";
import type { JourneyItem } from "@/types/journey";
import {
  createGroupSession,
  createIndividualSession,
  commandSession,
  addParticipant,
  getSessionById,
  type SessionType,
} from "@/lib/sessions";
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
  language?: string;
  playing?: boolean;
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
  const backendUrl =
    (import.meta.env.VITE_BACKEND_URL as string) ||
    (typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:8001`
      : "http://localhost:8001");
  const mqttWsUrl = (import.meta.env.VITE_MQTT_WS_URL as string) || "ws://localhost:9001";
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
  // Allow controller to remain visible even when all pairs are unpaired.
  // We pass a fallback activePair with only the sessionId so Stop/commands can still address the session.
  const activePairForController = useMemo(
    () =>
      activePair ||
      (activeSessionId ? { sessionId: activeSessionId, vrId: "", chairId: "", journeyId: [] as number[] } : null),
    [activePair, activeSessionId],
  );
  const [seekValues, setSeekValues] = useState<Record<string, number>>({});
  const [currentStep, setCurrentStep] = useState<FlowStep>("session-type");
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [selectedJourneyIds, setSelectedJourneyIds] = useState<string[]>([]);
  const [selectedJourneyLangs, setSelectedJourneyLangs] = useState<Record<string, string>>({});

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
          ? (root as { data?: SessionRec[] }).data || []
          : (root as SessionsEnvelope)?.data?.data || [];
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
              participants = Array.isArray(det?.data?.participants)
                ? (det!.data!.participants as ParticipantRec[])
                : [];
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              log(`Fallback session details load failed: ${message}`);
            }
          }
          const seededPairs = (participants || [])
            .filter((m) => m.vr_device_id && m.chair_device_id)
            .map((m) => ({
              sessionId: sid,
              vrId: String(m.vr_device_id),
              chairId: String(m.chair_device_id),
              journeyId: jids,
            }));
          // Set session context
          setPairs(seededPairs);
          setSelectedJourneyIds(jids.map((x) => String(x)));
          setSessionType((s.session_type as SessionType) || null);
          // Only enter controller if session is not completed/stopped AND we have at least one paired device
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const overall = (s as any)?.overall_status as string | undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const status = (s as any)?.status as string | undefined;
          if (overall !== "completed" && status !== "stopped" && seededPairs.length > 0) {
            setActiveSessionId(sid);
            void loadJourneys();
            setCurrentStep("controller");
            try {
              localStorage.setItem("nsc_active_session_id", sid);
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              log(`Failed to set active session ID: ${message}`);
            }
          } else {
            try {
              localStorage.removeItem("nsc_active_session_id");
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              log(`Failed to remove active session ID: ${message}`);
            }
            setActiveSessionId("");
            setCurrentStep("session-type");
          }
        } else {
          // Fallback: restore last active session by ID if present
          try {
            const storedId = localStorage.getItem("nsc_active_session_id");
            if (storedId) {
              const det = await getSessionById(storedId);
              const sid = det?.data?.id as string;
              if (sid) {
                const jids = Array.isArray(det?.data?.journey_ids) ? (det!.data!.journey_ids as number[]) : [];
                const participants = Array.isArray(det?.data?.participants)
                  ? (det!.data!.participants as ParticipantRec[])
                  : [];
                const seededPairs = (participants || [])
                  .filter((m) => m.vr_device_id && m.chair_device_id)
                  .map((m) => ({
                    sessionId: sid,
                    vrId: String(m.vr_device_id),
                    chairId: String(m.chair_device_id),
                    journeyId: jids,
                  }));
                setPairs(seededPairs);
                setSelectedJourneyIds(jids.map((x) => String(x)));
                setSessionType((det?.data?.session_type as SessionType) || null);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const overall = (det as any)?.data?.overall_status as string | undefined;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const status = (det as any)?.data?.status as string | undefined;
                if (overall !== "completed" && status !== "stopped" && seededPairs.length > 0) {
                  setActiveSessionId(sid);
                  void loadJourneys();
                  setCurrentStep("controller");
                } else {
                  try {
                    localStorage.removeItem("nsc_active_session_id");
                  } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    log(`Failed to remove active session ID: ${message}`);
                  }
                  setActiveSessionId("");
                  setCurrentStep("session-type");
                }
              }
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            log(`Failed to load ongoing session: ${message}`);
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`Failed to load ongoing session: ${message}`);
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
      // Console label for outbound admin-originated publishes
      try { console.log(`[ADMIN→DEVICE ${realtime.currentMode}]`, topic, payload); } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`Failed to publish topic: ${message}`);
      }
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
      // Console label for inbound device-originated MQTT messages
      try { console.log("[DEVICE→ADMIN MQTT]", t, p); } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`Failed to log message: ${message}`);
      }
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
            const rawStatus = String((data && data.status) || "").toLowerCase();
            // Normalize status variants
            const status =
              rawStatus === "playing"
                ? "active"
                : rawStatus === "paused" ||
                  rawStatus === "stopped" ||
                  rawStatus === "disconnect" ||
                  rawStatus === "disconnected"
                ? "idle"
                : rawStatus;
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
            if (typeof data?.language === "string") cur.language = String(data.language);
            cur.lastSeen = Date.now();
            map.set(id, cur);
            return map;
          });
        } else if (t.startsWith("devices/") && t.endsWith("/heartbeat")) {
          const id = t.split("/")[1];
          renderDevices((map) => {
            const cur: Device = map.get(id) || { id, type: "unknown", name: id, online: false };
            cur.online = true;
            cur.lastSeen = Date.now();
            map.set(id, cur);
            return map;
          });
        } else if (t.startsWith("devices/") && t.endsWith("/events")) {
          const id = t.split("/")[1];
          const data = JSON.parse(p || "{}");
          const event = String(data?.event || "").toLowerCase();
          renderDevices((map) => {
            const cur: Device = map.get(id) || { id, type: "unknown", name: id, online: false };
            // Events imply device is alive
            cur.online = true;
            // Update device type from event payload if available; otherwise infer from id
            const reportedType = String((data && data.type) || "").toLowerCase();
            if (reportedType === "vr" || reportedType === "chair") {
              cur.type = reportedType as DeviceType;
            } else if (cur.type === "unknown") {
              if (/^vr[_-]?/i.test(id)) cur.type = "vr";
              else if (/^chair[_-]?/i.test(id)) cur.type = "chair";
            }
            if (event === "select_journey" && data?.journeyId != null) {
              cur.currentJourneyId = Number(data.journeyId);
            }
            if (event === "play" || event === "playing" || event === "resume") {
              cur.status = "active";
              cur.playing = true;
            } else if (event === "pause" || event === "paused" || event === "stop" || event === "stopped") {
              cur.status = "idle";
              cur.playing = false;
            }
            if (typeof data?.positionMs === "number") cur.positionMs = Number(data.positionMs);
            if (typeof data?.sessionId === "string") cur.sessionId = String(data.sessionId);
            if (typeof data?.language === "string") cur.language = String(data.language);
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
            try { console.log("[DEVICE→ADMIN BRIDGE]","devices:snapshot", payload); } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              log(`Failed to log message: ${message}`);
            }
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
            try { console.log("[DEVICE→ADMIN BRIDGE]","device:discovered", d); } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              log(`Failed to log message: ${message}`);
            }
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
            try { console.log("[DEVICE→ADMIN BRIDGE]","device:heartbeat", h); } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              log(`Failed to log message: ${message}`);
            }
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
            try { console.log("[DEVICE→ADMIN BRIDGE]","device:status", s); } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              log(`Failed to log message: ${message}`);
            }
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
            try { console.log("[DEVICE→ADMIN BRIDGE]","device:offline", d); } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              log(`Failed to log message: ${message}`);
            }
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
              // Ensure UI treats playback as paused when device goes offline
              cur.status = "idle";
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
      // Always use session command API when sessionId is available
      if (sessionId) {
        const cmd = type === "play" ? "start" : (type as "pause" | "seek" | "stop");
        void commandSession(sessionId, cmd, { positionMs: Number(positionMs || 0), journeyId });
        return;
      }
      // Fallback path (no sessionId) – publish directly to device topics when available
      if (!p) {
        alert("No target devices available for command");
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
      try {
        localStorage.setItem("nsc_active_session_id", sid);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`Failed to set active session ID: ${message}`);
      }
      // Instruct all paired devices to join this session
      broadcastSessionJoin(
        sid,
        pairs.map((p) => ({ ...p, sessionId: sid })),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log(`Create session failed: ${message}`);
    }
  }, [pairs, log, broadcastSessionJoin, loadJourneys]);

  const handleCreateGroup = useCallback(async () => {
    try {
      if (pairs.length === 0 || !selectedJourneyIds) return;

      // Choose a default language to start with for the group:
      // if multiple journeys selected, prefer the first selected journey's chosen language; fallback to first track's language
      let defaultLang: string | null = null;
      const firstJid = selectedJourneyIds[0];
      if (firstJid && selectedJourneyLangs[firstJid!]) {
        defaultLang = selectedJourneyLangs[firstJid!];
      } else {
        const j = journeys.find((x) => String(x.journey?.id ?? x.video?.id ?? "") === String(firstJid ?? ""));
        const langCode = j?.audio_tracks?.[0]?.language_code;
        defaultLang = typeof langCode === "string" ? langCode : null;
      }
      const payloadMembers = pairs.map((p) => ({
        vrDeviceId: p.vrId,
        chairDeviceId: p.chairId,
        language: defaultLang || undefined,
      }));
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
    const map: Record<
      string,
      {
        status?: string;
        positionMs?: number;
        sessionId?: string;
        currentJourneyId?: number;
        lastEvent?: string;
        language?: string;
        playing?: boolean;
      }
    > = {};
    for (const d of devicesList) {
      map[d.id] = {
        status: d.status,
        positionMs: d.positionMs,
        sessionId: d.sessionId,
        currentJourneyId: d.currentJourneyId,
        lastEvent: d.lastEvent,
        language: d.language,
        playing: d.playing,
      };
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
              setSelectedJourneyIds={(updater: (prev: string[]) => string[]) =>
                setSelectedJourneyIds((prev) => updater(prev))
              }
              selectedJourneyLangs={selectedJourneyLangs}
              setSelectedJourneyLangs={(updater: (prev: Record<string, string>) => Record<string, string>) =>
                setSelectedJourneyLangs((prev) => updater(prev))
              }
              onCreateIndividual={() => void handleCreateIndividual()}
              onCreateGroup={() => void handleCreateGroup()}
            />
          )}

          {/* Step 4: Controller */}
          {currentStep === "controller" && (
            <ControllerStep
              activePair={activePairForController}
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
