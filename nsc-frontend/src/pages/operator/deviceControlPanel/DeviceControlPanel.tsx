import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mqttRealtime as realtime } from "@/lib/mqtt-realtime";
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
import LoggerPanel, { type LogEntry } from "./components/LoggerPanel";

type DeviceType = "vr" | "chair" | "unknown";

type Device = {
  id: string;
  type: DeviceType;
  name: string;
  online: boolean;
  deviceId?: string; // Hardware device ID for MQTT communication
  display_name?: string; // User-friendly display name
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
  const envUrl = import.meta.env.VITE_MQTT_WS_URL as string;
  const mqttWsUrl =
    (envUrl && !envUrl.includes("localhost"))
      ? envUrl
      : (typeof window !== "undefined"
        ? `ws://${window.location.hostname}:9001`
        : "ws://localhost:9001");
  const [forceBridge] = useState<boolean>(true);
  const [mqttUrl] = useState<string>(forceBridge ? backendUrl : mqttWsUrl);
  const [clientId] = useState<string>(`admin-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  const [username] = useState<string>("admin@example.com");
  const [password] = useState<string>("Admin@123");

  // Ref to track initial session load
  const initialLoadRef = useRef<boolean>(false);

  // Journeys
  const [journeys, setJourneys] = useState<JourneyItem[]>([]);
  const [journeysLoading, setJourneysLoading] = useState<boolean>(false);

  // Connection
  const [connected, setConnected] = useState<boolean>(false);
  const [mode, setMode] = useState<Mode>("mqtt");

  // Devices & pairs
  const [devicesMap, setDevicesMap] = useState<Map<string, Device>>(new Map());
  const devicesList = useMemo(() => {
    const list = Array.from(devicesMap.values());
    // Log online devices for debugging
    const onlineDevices = list.filter(d => d.online);
    const vrOnline = onlineDevices.filter(d => d.type === 'vr').map(d => d.id);
    const chairOnline = onlineDevices.filter(d => d.type === 'chair').map(d => d.id);
    console.log(`[Devices] VR online: [${vrOnline.join(', ')}], Chair online: [${chairOnline.join(', ')}]`);
    return list;
  }, [devicesMap]);

  const [pairs, setPairs] = useState<Pair[]>([]);
  // Return ALL devices of each type - DeviceSelectionStep will check online status
  const vrDevices = useMemo(() => {
    return devicesList.filter((d) => d.type === "vr");
  }, [devicesList]);
  const chairDevices = useMemo(() => {
    return devicesList.filter((d) => d.type === "chair");
  }, [devicesList]);
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoggerOpen, setIsLoggerOpen] = useState(false);

  const log = useCallback((entry: string | Partial<LogEntry>) => {
    const ts = new Date().toLocaleTimeString();
    let newEntry: LogEntry;

    if (typeof entry === "string") {
      newEntry = {
        id: Math.random().toString(36).slice(2),
        timestamp: ts,
        category: "system",
        direction: "info",
        eventType: "info",
        summary: entry,
      };
    } else {
      newEntry = {
        id: Math.random().toString(36).slice(2),
        timestamp: ts,
        category: "system",
        direction: "info",
        eventType: "info",
        summary: "Log entry",
        ...entry,
      } as LogEntry;
    }
    setLogs((prev) => [...prev, newEntry].slice(-1000));
  }, []);

  // API wrapper for logging
  const apiCall = useCallback(
    async <T,>(method: string, url: string, fn: () => Promise<T>, summary?: string): Promise<T> => {
      const start = Date.now();
      try {
        const res = await fn();
        log({
          category: "api",
          direction: "in",
          eventType: "success",
          method,
          url,
          summary: summary || `${method} ${url}`,
          details: { status: "success", duration: `${Date.now() - start}ms`, response: res },
        });
        return res;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log({
          category: "api",
          direction: "in",
          eventType: "error",
          method,
          url,
          summary: `FAILED: ${summary || `${method} ${url}`}`,
          details: { status: "error", duration: `${Date.now() - start}ms`, error: message },
        });
        throw e;
      }
    },
    [log],
  );

  // Journeys loader (used by selection and when auto-locking into controller)
  const loadJourneys = useCallback(async () => {
    try {
      setJourneysLoading(true);
      const res = await apiCall(
        "GET",
        "/journeys",
        () =>
          api.get<{ total?: number; page?: number; limit?: number; data?: { data: JourneyItem[] } }>("journeys", {
            page: 1,
            limit: 24,
          }),
        "Fetch Journeys",
      );
      const list = (res?.data?.data as unknown as JourneyItem[]) || res?.data?.data || [];
      setJourneys(list);
    } catch (e: unknown) {
      // Logged in apiCall
    } finally {
      setJourneysLoading(false);
    }
  }, [log, apiCall]);

  // Load ongoing sessions on initial mount to lock into controller if needed
  useEffect(() => {
    const loadOngoing = async () => {
      // Prevent loading if we've already loaded the initial session
      if (initialLoadRef.current) return;
      initialLoadRef.current = true;

      try {
        const res = await apiCall(
          "GET",
          "/sessions?status=on_going",
          () => api.get<SessionsEnvelope | { data?: SessionRec[] }>("sessions", { status: "on_going" }),
          "Check Ongoing Sessions",
        );
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

  const renderDevices = useCallback((updater: (prev: Map<string, Device>) => Map<string, Device>) => {
    setDevicesMap((prev: Map<string, Device>) => {
      const next = new Map(prev);
      return updater(next);
    });
  }, []);

  const subscribeTopic = useCallback(
    (topic: string) => {
      if (!connected) return;
      realtime.subscribe(topic, 1);
      log(`Subscribed to ${topic}`);
    },
    [connected, log],
  );

  const publishTopic = useCallback(
    (topic: string, payload: string, retain = false) => {
      if (!connected) return;
      realtime.publish(topic, payload, retain, 1);

      // Extract device ID if present
      const deviceIdMatch = topic.match(/devices\/([^/]+)/);
      const deviceId = deviceIdMatch ? deviceIdMatch[1] : undefined;

      let eventType: "command" | "info" = "info";
      if (topic.includes("/commands/")) eventType = "command";

      let details: any = payload;
      try {
        details = JSON.parse(payload);
      } catch (e) { }

      log({
        category: "mqtt",
        direction: "out",
        eventType,
        topic,
        deviceId,
        summary: topic,
        details,
      });
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
      const deviceId = t.split("/")[1] || "";
      const details = p ? (p.length > 100 ? p.substring(0, 100) + "..." : p) : "";

      // Minimal logging - only log device status changes, not every message
      // console.log('[MQTT]', t);

      log({
        category: "mqtt",
        direction: "in",
        eventType: "info",
        topic: t,
        deviceId,
        summary: t,
        details,
      });

      try {
        // Handle admin devices snapshot (retained message)
        if (t === "admin/devices/snapshot") {
          const devices = JSON.parse(p || "[]") as Array<{
            deviceId: string;
            type: DeviceType;
            name: string;
            online: boolean;
            lastSeen?: string;
            metadata?: any;
          }>;

          renderDevices((map: Map<string, Device>) => {
            // Merge snapshot with existing devices
            // Snapshot devices are ALWAYS offline initially - only real-time messages mark them online
            const next = new Map<string, Device>(map);
            devices.forEach((d) => {
              const existing = next.get(d.deviceId);
              
              // If device already exists, keep its current online status
              // For NEW devices from snapshot, start as OFFLINE - wait for heartbeat/status to mark online
              const onlineStatus = existing ? existing.online : false;
              
              next.set(d.deviceId, {
                id: d.deviceId,
                deviceId: d.deviceId,
                type: d.type || existing?.type || "unknown",
                name: d.name || existing?.name || d.deviceId,
                online: onlineStatus, // New devices start offline, existing keep their status
                lastSeen: existing?.lastSeen || (d.lastSeen ? new Date(d.lastSeen).getTime() : Date.now()),
              });
            });
            return next;
          });
          log({ category: "mqtt", direction: "in", eventType: "info", topic: t, summary: `Snapshot: ${devices.length} devices` });
          return;
        }

        // Handle Last Will Testament (device offline)
        // LWT is sent by broker when device disconnects unexpectedly
        if (t.startsWith("devices/") && t.endsWith("/lwt")) {
          const id = t.split("/")[1];
          // Check if payload indicates offline (LWT payload is "offline" or contains status: "offline")
          const lwtPayload = p.toLowerCase();
          const isOffline = lwtPayload === "offline" || lwtPayload.includes('"status":"offline"') || lwtPayload.includes('"online":false');
          
          // Only mark offline if LWT indicates offline, not if it's "online" (device clearing its LWT)
          if (isOffline) {
            console.log(`[DeviceControlPanel] LWT received for ${id} - marking offline`);
            renderDevices((map: Map<string, Device>) => {
              const cur = map.get(id);
              if (cur) {
                map.set(id, {
                  ...cur,
                  online: false,
                  status: "idle",
                  playing: false,
                  lastSeen: Date.now(),
                });
              }
              return new Map(map);
            });
            log({ category: "mqtt", direction: "in", eventType: "info", topic: t, deviceId: id, summary: `Device offline (LWT): ${id}` });
          } else {
            console.log(`[DeviceControlPanel] LWT received for ${id} with payload: ${p} - NOT marking offline`);
          }
          return;
        }

        if (t === "devices/discovery/announce") {
          const d = JSON.parse(p || "{}") as {
            deviceId?: string;
            type?: DeviceType;
            name?: string;
            display_name?: string;
          };
          const id = d.deviceId;
          if (!id) return;
          renderDevices((map: Map<string, Device>) => {
            const cur: Device = map.get(id) || {
              id,
              type: (d.type as DeviceType) || "unknown",
              name: d.display_name || d.name || id,
              online: false,
            };
            // Create new object to trigger React re-render
            // Device announcement means device is ONLINE
            map.set(id, {
              ...cur,
              type: (d.type as DeviceType) || cur.type,
              name: d.display_name || d.name || cur.name,
              display_name: d.display_name || cur.display_name,
              online: true, // ✅ Device announcing itself = online
              lastSeen: Date.now(),
            });
            return new Map(map);
          });
          log({ category: "mqtt", direction: "in", eventType: "info", topic: t, deviceId: id, summary: `Device announced: ${id}` });
        } else if (t.startsWith("devices/") && t.endsWith("/status")) {
          const id = t.split("/")[1];
          const data = JSON.parse(p || "{}") as {
            status?: string;
            type?: string;
            positionMs?: number;
            sessionId?: string;
            language?: string;
            display_name?: string;
          };
          renderDevices((map: Map<string, Device>) => {
            const cur: Device = map.get(id) || { id, type: "unknown", name: data?.display_name || id, online: false };
            const rawStatus = String((data && data.status) || "").toLowerCase();
            // Normalize status variants
            const status =
              rawStatus === "playing"
                ? "active"
                : rawStatus === "paused" ||
                  rawStatus === "stopped"
                  ? "idle"
                  : rawStatus || "idle"; // Default to idle if empty
            
            // Device is online if it's sending status messages (unless explicitly disconnected)
            // Only mark offline if status explicitly says "disconnect" or "disconnected" or "offline"
            const isDisconnectStatus = ["disconnect", "disconnected", "offline"].includes(rawStatus);
            const online = !isDisconnectStatus; // Online unless explicitly disconnected
            
            // Update device type from status payload if provided
            const reportedType = String((data && data.type) || "").toLowerCase();
            let deviceType = cur.type;
            if (reportedType === "vr" || reportedType === "chair") {
              deviceType = reportedType as DeviceType;
            } else if (cur.type === "unknown") {
              // Fallback: infer from deviceId prefix
              if (/^vr[_-]?/i.test(id)) deviceType = "vr";
              else if (/^chair[_-]?/i.test(id)) deviceType = "chair";
            }
            
            // Create new object to trigger React re-render
            map.set(id, {
              ...cur,
              online,
              status: status || cur.status,
              type: deviceType,
              positionMs: typeof data?.positionMs === "number" ? Number(data.positionMs) : cur.positionMs,
              sessionId: typeof data?.sessionId === "string" ? String(data.sessionId) : cur.sessionId,
              language: typeof data?.language === "string" ? String(data.language) : cur.language,
              display_name: data?.display_name || cur.display_name,
              lastSeen: Date.now(),
            });
            return new Map(map);
          });
        } else if (t.startsWith("devices/") && t.endsWith("/heartbeat")) {
          const id = t.split("/")[1];
          const heartbeatData = JSON.parse(p || "{}") as { type?: string; deviceId?: string };
          renderDevices((map: Map<string, Device>) => {
            const cur: Device = map.get(id) || { id, type: "unknown", name: id, online: false };
            
            // Update device type from heartbeat payload if provided
            const reportedType = String(heartbeatData?.type || "").toLowerCase();
            let deviceType = cur.type;
            if (reportedType === "vr" || reportedType === "chair") {
              deviceType = reportedType as DeviceType;
            } else if (cur.type === "unknown") {
              // Fallback: infer from deviceId prefix
              if (/^vr[_-]?/i.test(id)) deviceType = "vr";
              else if (/^chair[_-]?/i.test(id)) deviceType = "chair";
            }
            
            // Create new object to trigger React re-render
            map.set(id, {
              ...cur,
              type: deviceType,
              online: true,
              lastSeen: Date.now(),
            });
            return new Map(map);
          });
        } else if (t.startsWith("devices/") && t.endsWith("/events")) {
          const id = t.split("/")[1];
          const data = JSON.parse(p || "{}") as {
            event?: string;
            type?: string;
            journeyId?: number;
            playing?: boolean;
            positionMs?: number;
            sessionId?: string;
            language?: string;
            display_name?: string;
            timestamp?: string;
          };
          const event = String(data?.event || "").toLowerCase();
          renderDevices((map: Map<string, Device>) => {
            const cur: Device = map.get(id) || { id, type: "unknown", name: data?.display_name || id, online: false };
            
            // Update device type from event payload if available; otherwise infer from id
            const reportedType = String((data && data.type) || "").toLowerCase();
            let deviceType = cur.type;
            if (reportedType === "vr" || reportedType === "chair") {
              deviceType = reportedType as DeviceType;
            } else if (cur.type === "unknown") {
              if (/^vr[_-]?/i.test(id)) deviceType = "vr";
              else if (/^chair[_-]?/i.test(id)) deviceType = "chair";
            }
            
            let status = cur.status;
            let playing = cur.playing;
            if (event === "select_journey" && data?.journeyId != null) {
              // Journey selection doesn't change playing state
            } else if (event === "play" || event === "playing" || event === "resume") {
              status = "active";
              playing = true;
            } else if (event === "pause" || event === "paused" || event === "stop" || event === "stopped") {
              status = "idle";
              playing = false;
            }
            
            // Create new object to trigger React re-render
            map.set(id, {
              ...cur,
              online: true, // Events imply device is alive
              type: deviceType,
              status,
              playing,
              currentJourneyId: event === "select_journey" && data?.journeyId != null ? Number(data.journeyId) : cur.currentJourneyId,
              positionMs: typeof data?.positionMs === "number" ? Number(data.positionMs) : cur.positionMs,
              sessionId: typeof data?.sessionId === "string" ? String(data.sessionId) : cur.sessionId,
              language: typeof data?.language === "string" ? String(data.language) : cur.language,
              display_name: data?.display_name || cur.display_name,
              lastEvent: event,
              lastEventTimestamp: String(data?.timestamp || ""),
              lastSeen: Date.now(),
            });
            return new Map(map);
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
      // Connect to MQTT broker via WebSocket
      await realtime.connect({ url: mqttWsUrl.trim(), clientId, username, password });
      setMode("mqtt");
      setConnected(true);
      log(`Connected to MQTT broker: ${mqttWsUrl}`);

      // Register message handler
      const offMsg = realtime.onMessage((msg) => handleMessage(msg));

      // Subscribe to device topics - call realtime.subscribe directly to avoid state timing issues
      const topics = [
        "admin/devices/snapshot", // Retained message with all devices
        "devices/discovery/announce",
        "devices/+/status",
        "devices/+/heartbeat",
        "devices/+/events",
        "devices/+/lwt", // Last Will Testament for offline detection
      ];
      
      topics.forEach((topic) => {
        realtime.subscribe(topic, 1);
        log(`Subscribed to ${topic}`);
      });

      // Request a fresh snapshot after subscribing (in case retained message is stale)
      setTimeout(() => {
        realtime.publish("admin/devices/request_snapshot", JSON.stringify({ timestamp: Date.now() }), false, 1);
      }, 1000);

      (window as unknown as { __realtimeOffs?: Array<() => void> }).__realtimeOffs = [offMsg];
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log(`Connect error: ${message}`);
    }
  }, [
    clientId,
    handleMessage,
    log,
    mqttWsUrl,
    password,
    username,
    connected,
  ]);

  useEffect(() => {
    // Only connect once on mount
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Stale device detection - DISABLED for stability
  // Devices only go offline via:
  // 1. LWT (Last Will Testament) when broker detects disconnect
  // 2. Explicit disconnect message from device
  // This prevents flickering and false offline detection
  // 
  // If you need stale detection, uncomment below with a VERY long threshold (5+ minutes)
  /*
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const STALE_THRESHOLD = 300000; // 5 minutes - very conservative
      
      setDevicesMap((prev) => {
        let hasChanges = false;
        const next = new Map(prev);
        
        for (const [id, device] of next.entries()) {
          if (device.online && device.lastSeen && (now - device.lastSeen) > STALE_THRESHOLD) {
            console.log(`[DeviceControlPanel] Device ${id} marked offline (no heartbeat for ${Math.round((now - device.lastSeen) / 1000)}s)`);
            hasChanges = true;
            next.set(id, { ...device, online: false });
          }
        }
        
        return hasChanges ? next : prev;
      });
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, []);
  */

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
      // Look up hardware deviceId from device list (devices listen to their hardware ID, not database ID)
      const vrDevice = devicesList.find((d) => d.id === pair.vrId);
      const chairDevice = devicesList.find((d) => d.id === pair.chairId);
      const vrHwId = vrDevice?.deviceId || pair.vrId;
      const chairHwId = chairDevice?.deviceId || pair.chairId;
      publishTopic(`devices/${vrHwId}/commands/${type}`, JSON.stringify(payload), false);
      publishTopic(`devices/${chairHwId}/commands/${type}`, JSON.stringify(payload), false);
    },
    [publishTopic, devicesList],
  );

  const resetFlow = useCallback(() => {
    setSelectedVrId("");
    setSelectedChairId("");
    setActiveSessionId("");
    setPairs([]);
    setSelectedJourneyIds([]);
    setSessionType(null);
    setCurrentStep("session-type");
    // Reset the initial load ref to allow ongoing session detection on next mount
    initialLoadRef.current = false;
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
      const rec = await apiCall(
        "POST",
        "/sessions (individual)",
        () =>
          createIndividualSession({
            session_type: "individual",
            vrDeviceId: first.vrId,
            chairDeviceId: first.chairId,
          }),
        "Create Individual Session",
      );
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
      setPairs((prev: Pair[]) => prev.map((p: Pair) => ({ ...p, sessionId: sid })));
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
        pairs.map((p: Pair) => ({ ...p, sessionId: sid })),
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
      const payloadMembers = pairs.map((p: Pair) => ({
        vrDeviceId: p.vrId,
        chairDeviceId: p.chairId,
        language: defaultLang || undefined,
      }));
      const res = await apiCall(
        "POST",
        "/sessions (group)",
        () =>
          createGroupSession({
            session_type: "group",
            members: payloadMembers,
            journeyIds: selectedJourneyIds.map((id: string) => parseInt(id)),
          }),
        "Create Group Session",
      );
      const sid = res.session.id;
      setPairs((prev: Pair[]) =>
        prev.map((p: Pair) => ({
          ...p,
          sessionId: sid,
          journeyId: selectedJourneyIds.map((id: string) => parseInt(id)),
        })),
      );
      setActiveSessionId(sid);
      setCurrentStep("controller");
      log(`Group session created: ${sid} (group: ${res.groupId})`);
      // After creation, instruct all paired devices to join this session
      const enriched = pairs.map((p: Pair) => ({
        ...p,
        sessionId: sid,
        journeyId: selectedJourneyIds.map((id: string) => parseInt(id)),
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
        <ProgressStepper
          currentStepNumber={currentStepNumber}
          connected={connected}
          mode={mode}
          sessionType={sessionType}
          onToggleLogger={() => setIsLoggerOpen(!isLoggerOpen)}
        />

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
              setPairs={(updater: (prev: Pair[]) => Pair[]) => setPairs((prev: Pair[]) => updater(prev))}
              onBack={resetFlow}
              onContinue={() => {
                if (sessionType === "individual") {
                  // For individual sessions, skip journey selection step
                  // Journey selection will be done in controller
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
                setSelectedJourneyIds((prev: string[]) => updater(prev))
              }
              selectedJourneyLangs={selectedJourneyLangs}
              setSelectedJourneyLangs={(updater: (prev: Record<string, string>) => Record<string, string>) =>
                setSelectedJourneyLangs((prev: Record<string, string>) => updater(prev))
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
              setSeekValues={(updater: (prev: Record<string, number>) => Record<string, number>) =>
                setSeekValues((prev: Record<string, number>) => updater(prev))
              }
              sendCmd={sendCmd}
              sendParticipantCmd={sendParticipantCmd}
              onNewSession={resetFlow}
              onResendSession={() => {
                const targets = pairs.filter((p: Pair) => p.sessionId === activeSessionId);
                if (activeSessionId && targets.length) broadcastSessionJoin(activeSessionId, targets);
              }}
              pairs={pairs}
              setPairs={(updater: (prev: Pair[]) => Pair[]) => setPairs((prev: Pair[]) => updater(prev))}
              onlineById={onlineById}
              deviceInfoById={deviceInfoById}
              vrDevices={vrDevices}
              chairDevices={chairDevices}
              sessionType={sessionType}
            />
          )}
        </div>
      </div>
      <LoggerPanel
        logs={logs}
        isOpen={isLoggerOpen}
        onToggle={() => setIsLoggerOpen(!isLoggerOpen)}
        onClear={() => setLogs([])}
      />
    </div>
  );
}
