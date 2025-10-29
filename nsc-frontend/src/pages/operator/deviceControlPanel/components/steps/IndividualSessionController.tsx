import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Armchair, Headset, Dot, CirclePower, RefreshCw, InfoIcon, Users, X, Plus } from "lucide-react";
import type { JourneyItem } from "@/types/journey";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/media/VideoPlayer";
import {
  commandParticipant,
  getSessionById,
  addParticipant as apiAddParticipant,
  removeParticipant as apiRemoveParticipant,
  type SessionDetailsEnvelope,
} from "@/lib/sessions";
import type { BaseControllerProps } from "./types";

export default function IndividualSessionController({
  activePair,
  journeys,
  setSeekValues,
  sendCmd,
  onNewSession,
  onResendSession,
  pairs = [],
  setPairs,
  onlineById = {},
  deviceInfoById = {},
  vrDevices = [],
  chairDevices = [],
  sendParticipantCmd,
  sessionOfflineDevices,
}: BaseControllerProps) {
  // Per-participant audio selection state (declare hooks before any early return)
  const [audioSel, setAudioSel] = useState<Record<string, string>>({});
  const [currentJourneyIdx, setCurrentJourneyIdx] = useState(0);

  // For group sessions, collect all pairs in the same session for display
  const sessionPairs = useMemo(
    () => (activePair ? pairs.filter((p) => p.sessionId && p.sessionId === activePair.sessionId) : []),
    [activePair, pairs],
  );

  const journeyIdsAll = useMemo(
    () =>
      (Array.isArray(activePair?.journeyId)
        ? activePair?.journeyId
        : activePair?.journeyId
        ? [activePair?.journeyId]
        : []) as number[],
    [activePair?.journeyId],
  );
  const journeyCards = useMemo(
    () =>
      journeyIdsAll
        .map((jid) => ({ jid, item: journeys.find((j) => String(j.journey?.id ?? j.video?.id ?? "") === String(jid)) }))
        .filter((x) => !!x.item) as Array<{ jid: number; item: JourneyItem }>,
    [journeyIdsAll, journeys],
  );

  // Memoized list of all journeys as selectable cards (id + item)
  const memoAllJourneyCards = useMemo(
    () =>
      journeys
        .map((j) => ({ jid: Number(j?.journey?.id ?? j?.video?.id), item: j }))
        .filter((x) => Number.isFinite(x.jid)) as Array<{ jid: number; item: JourneyItem }>,
    [journeys],
  );

  const currentCard = journeyCards[currentJourneyIdx] || journeyCards[0];
  const primaryMedia = currentCard?.item;
  const durationMs = Number(primaryMedia?.video?.duration_ms || 0);

  // Determine playing/paused from device statuses
  const vrInfoActive = activePair ? deviceInfoById[activePair.vrId]?.status === "active" : false;
  const chairInfoActive = activePair ? deviceInfoById[activePair.chairId]?.status === "active" : false;
  const isPlaying = vrInfoActive || chairInfoActive;
  // Slider drag state to avoid fighting auto updates while user is dragging
  const manualPausedRef = useRef(false);
  const playerRefs = useRef<Record<string, VideoPlayerHandle | null>>({});
  const [participantIdByPair, setParticipantIdByPair] = useState<Record<string, string>>({});
  const [selectedJourneyByPair, setSelectedJourneyByPair] = useState<Record<string, number>>({});
  const [selectedVrId, setSelectedVrId] = useState("");
  const [selectedChairId, setSelectedChairId] = useState("");
  const [showPairModal, setShowPairModal] = useState(false);

  // Filter out already paired devices
  const pairedVrIds = useMemo(() => new Set(sessionPairs.map((p) => p.vrId)), [sessionPairs]);
  const pairedChairIds = useMemo(() => new Set(sessionPairs.map((p) => p.chairId)), [sessionPairs]);
  const availableVrDevices = useMemo(() => vrDevices.filter((d) => !pairedVrIds.has(d.id)), [vrDevices, pairedVrIds]);
  const availableChairDevices = useMemo(
    () => chairDevices.filter((d) => !pairedChairIds.has(d.id)),
    [chairDevices, pairedChairIds],
  );

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    setCurrentJourneyIdx(0);
    if (activePair) {
      setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
    }
    didInitRef.current = true;
  }, [activePair, journeyCards, setSeekValues]);

  // Build participantId mapping for Individual sessions (batched updates)
  useEffect(() => {
    const sid = activePair?.sessionId;
    if (!sid) return;
    const load = async () => {
      try {
        const res: SessionDetailsEnvelope = await getSessionById(sid!);
        // If session has been stopped/completed, clear and bail out
        const d = (res?.data ?? undefined) as Record<string, unknown> | undefined;
        const overall = typeof d?.overall_status === "string" ? (d.overall_status as string) : undefined;
        const status = typeof d?.status === "string" ? (d.status as string) : undefined;
        if (overall === "completed" || status === "stopped") {
          try {
            setPairs?.((prev) => prev.filter((p) => p.sessionId !== sid));
          } catch (e) {
            void e;
          }
          try {
            setParticipantIdByPair({});
            setSelectedJourneyByPair({});
            setAudioSel({});
            setSeekValues((prev) => ({ ...prev, [sid]: 0 }));
          } catch (e) {
            void e;
          }
          return;
        }
        const parts = res?.data?.participants || [];
        const nextMap: Record<string, string> = {};
        const nextSelected: Record<string, number> = {};
        const nextAudio: Record<string, string> = {};
        parts.forEach((m) => {
          const vr = String(m.vr_device_id || "");
          const ch = String(m.chair_device_id || "");
          const pid = String(m.id || "");
          const jid = m.current_journey_id || m.journey_id; // Check both fields
          const lang = m.language;

          if (vr && ch && pid) {
            const key = `${vr}-${ch}`;
            nextMap[key] = pid;

            // Load journey from backend if exists
            if (jid != null) {
              nextSelected[key] = Number(jid);
            }

            // Load language from backend if exists
            if (lang && journeys.length > 0) {
              const journey = journeys.find((j) => String(j.journey?.id ?? j.video?.id) === String(jid));
              if (journey?.audio_tracks) {
                const matchingTrack = journey.audio_tracks.find((t) => t.language_code === lang);
                if (matchingTrack?.url) {
                  nextAudio[key] = matchingTrack.url!;
                }
              }
            }
          }
        });

        setParticipantIdByPair((prev) => (JSON.stringify(prev) !== JSON.stringify(nextMap) ? nextMap : prev));
        setSelectedJourneyByPair((prev) => (Object.keys(nextSelected).length ? { ...prev, ...nextSelected } : prev));
        setAudioSel((prev) => (Object.keys(nextAudio).length ? { ...prev, ...nextAudio } : prev));
      } catch (e) {
        console.error(`[ControllerStep] Failed to load participants for session ${sid}:`, e);
      }
    };
    void load();
  }, [activePair?.sessionId, journeys]);

  useEffect(() => {
    if (!isPlaying) manualPausedRef.current = false;
  }, [isPlaying]);

  useEffect(() => {
    if ((sessionOfflineDevices?.length ?? 0) > 0 && sendParticipantCmd) {
      sessionOfflineDevices?.forEach((deviceId) => {
        const offlinePair = sessionPairs.find((p) => p.vrId === deviceId || p.chairId === deviceId);
        if (offlinePair) {
          const pairKey = `${offlinePair.vrId}-${offlinePair.chairId}`;
          const devicePositionMs = playerRefs.current[pairKey]?.getCurrentTimeMs() || 0;
          sendParticipantCmd({ vrId: offlinePair.vrId, chairId: offlinePair.chairId }, "pause", devicePositionMs);
          const k = `${offlinePair.vrId}-${offlinePair.chairId}`;
          playerRefs.current[k]?.pause?.();
        }
      });
    }
  }, [sessionOfflineDevices, sessionPairs, sendParticipantCmd]);

  // Sync device-selected journey and language to UI state for Individual sessions
  useEffect(() => {
    const updatesSelected: Record<string, number> = {};
    const updatesAudio: Record<string, string> = {};
    sessionPairs.forEach((p) => {
      const key = `${p.vrId}-${p.chairId}`;
      const vrInfo = deviceInfoById[p.vrId];
      const chairInfo = deviceInfoById[p.chairId];
      const deviceJourneyId = vrInfo?.currentJourneyId ?? chairInfo?.currentJourneyId;
      if (deviceJourneyId != null && selectedJourneyByPair[key] !== deviceJourneyId) {
        updatesSelected[key] = deviceJourneyId;
        const deviceLanguage = vrInfo?.language ?? chairInfo?.language;
        if (deviceLanguage) {
          const journey = journeys.find((j) => String(j.journey?.id ?? j.video?.id) === String(deviceJourneyId));
          if (journey?.audio_tracks) {
            const matchingTrack = journey.audio_tracks.find((t) => t.language_code === deviceLanguage);
            if (matchingTrack?.url) {
              updatesAudio[key] = matchingTrack.url!;
            }
          }
        }
      }
    });
    if (Object.keys(updatesSelected).length) setSelectedJourneyByPair((prev) => ({ ...prev, ...updatesSelected }));
    if (Object.keys(updatesAudio).length) setAudioSel((prev) => ({ ...prev, ...updatesAudio }));
  }, [deviceInfoById, sessionPairs, selectedJourneyByPair, journeys]);
  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-white text-xl mb-1">Individual Session Control</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 py-0 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                    onClick={onResendSession}
                    title="Resend session ID to all paired devices"
                  >
                    Re-Broadcast <RefreshCw className="w-4 h-4" />
                  </Button>
                  <div className="relative group inline-flex items-center ml-2">
                    <InfoIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-200" />
                    <div
                      className="pointer-events-none absolute z-20 bottom-5 mt-2 left-1/2 -translate-x-1/9 w-96 rounded-md border border-slate-700 bg-slate-900/95 text-slate-200 px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
                      role="tooltip"
                    >
                      If the session ID isn’t published to the VR or Motion Chair, click Re-Broadcast to send it again.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                  onClick={() => setShowPairModal(true)}
                >
                  <Users className="w-4 h-4" />
                  Manage Pairs ({sessionPairs.length})
                </Button>
              </div>
            </div>

            <Button
              onClick={() => {
                if (!activePair) return;
                const sid = activePair.sessionId;
                // Send stop to backend
                sendCmd(sid, "stop");
                // Immediately unpair all devices from this session locally to avoid stale reloads
                try {
                  setPairs?.((prev) => prev.filter((p) => p.sessionId !== sid));
                } catch (e) {
                  void e;
                }
                try {
                  setParticipantIdByPair({});
                  setSelectedJourneyByPair({});
                  setAudioSel({});
                  if (sid) setSeekValues((prev) => ({ ...prev, [sid]: 0 }));
                } catch (e) {
                  void e;
                }
                // Navigate back to new session flow
                onNewSession();
              }}
              variant="destructive"
              className="gap-2 text-base font-semibold"
            >
              <CirclePower className="w-5 h-5" /> Stop Session
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* All Participants (group) */}
          {sessionPairs.length > 0 && (
            <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
              <div className="text-white font-semibold mb-3">Devices ({sessionPairs.length})</div>
              <div className="grid sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
                {sessionPairs.map((p, i) => {
                  const vrOnline = !!onlineById[p.vrId];
                  const chairOnline = !!onlineById[p.chairId];
                  const key = `${p.vrId}-${p.chairId}`;

                  // For Individual, prefer device-selected journey from real-time events
                  const vrInfo = deviceInfoById[p.vrId];
                  const chairInfo = deviceInfoById[p.chairId];
                  const deviceJourneyId = vrInfo?.currentJourneyId ?? chairInfo?.currentJourneyId;
                  const devicePositionMs =
                    typeof vrInfo?.positionMs === "number" && isFinite(vrInfo.positionMs)
                      ? vrInfo.positionMs
                      : typeof chairInfo?.positionMs === "number" && isFinite(chairInfo.positionMs)
                      ? chairInfo.positionMs
                      : undefined;
                  const currentJid =
                    deviceJourneyId ??
                    selectedJourneyByPair[key] ??
                    (Array.isArray(p.journeyId) ? p.journeyId[0] : p.journeyId);

                  // Media item: shared (group) or per-participant (individual with device-selected journey)
                  const mediaItem = journeys.find(
                    (j) => String(j.journey?.id ?? j.video?.id ?? "") === String(currentJid ?? ""),
                  );

                  const vSrc = mediaItem?.video?.url || "";
                  const tracks = mediaItem?.audio_tracks || [];
                  const defaultAudio = tracks[0]?.url || "";
                  const selSrc = audioSel[key] ?? defaultAudio;
                  const seekKey = key;
                  const allJourneyCards = memoAllJourneyCards;
                  return (
                    <div
                      key={`${p.vrId}-${p.chairId}-${i}`}
                      className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden"
                    >
                      <div className="relative">
                        {sessionOfflineDevices?.includes(p.vrId) || sessionOfflineDevices?.includes(p.chairId) ? (
                          <div className="w-full aspect-video bg-red-500/50 flex items-center justify-center text-white absolute top-0 left-0 z-10 font-bold text-2xl text-shadow text-pretty">
                            {sessionOfflineDevices?.includes(p.vrId) ? `${p.vrId} Device Offline` : null}
                            {sessionOfflineDevices?.includes(p.chairId) ? `${p.chairId} Device Offline` : null}
                          </div>
                        ) : (
                          <></>
                        )}
                        {vSrc ? (
                          <VideoPlayer
                            key={`${key}-${currentJid}`}
                            ref={(inst: VideoPlayerHandle | null) => {
                              const k = `${p.vrId}-${p.chairId}`;
                              playerRefs.current[k] = inst;
                            }}
                            src={vSrc}
                            className="w-full"
                            isMuted={false}
                            isShowVolume={false}
                            isShowFullscreen={false}
                            isShowPlayPause={
                              sessionOfflineDevices?.includes(p.vrId) || sessionOfflineDevices?.includes(p.chairId)
                                ? false
                                : true
                            }
                            isShowSeek={
                              sessionOfflineDevices?.includes(p.vrId) || sessionOfflineDevices?.includes(p.chairId)
                                ? false
                                : true
                            }
                            isShowProgress={
                              sessionOfflineDevices?.includes(p.vrId) || sessionOfflineDevices?.includes(p.chairId)
                                ? false
                                : true
                            }
                            externalPlaying={vrInfo?.playing || chairInfo?.playing}
                            externalCurrentMs={
                              typeof devicePositionMs === "number" && isFinite(devicePositionMs)
                                ? devicePositionMs
                                : undefined
                            }
                            ontogglePlay={(playing: boolean) => {
                              if (!sendParticipantCmd) return;
                              if (playing) {
                                // Include current position to ensure resume on devices that require it
                                const currentMs =
                                  typeof devicePositionMs === "number" && isFinite(devicePositionMs)
                                    ? devicePositionMs
                                    : playerRefs.current[key]?.getCurrentTimeMs() || 0;
                                sendParticipantCmd({ vrId: p.vrId, chairId: p.chairId }, "play", currentMs);
                              } else {
                                // Prefer device-reported position for accuracy in Individual mode
                                const currentMs =
                                  typeof devicePositionMs === "number" && isFinite(devicePositionMs)
                                    ? devicePositionMs
                                    : playerRefs.current[key]?.getCurrentTimeMs() || 0;
                                sendParticipantCmd({ vrId: p.vrId, chairId: p.chairId }, "pause", currentMs);
                              }
                            }}
                            onSeekEnd={(ms: number) => {
                              if (!sendParticipantCmd) return;
                              sendParticipantCmd({ vrId: p.vrId, chairId: p.chairId }, "seek", ms);
                            }}
                            onTimeUpdateMs={(ms: number) => {
                              if (!activePair?.sessionId) return;
                              const clamped = Math.max(0, Math.min(durationMs || 0, Math.floor(ms || 0)));
                              if (seekKey) setSeekValues((prev) => ({ ...prev, [seekKey]: clamped }));
                            }}
                          />
                        ) : (
                          <div className="w-full aspect-video bg-slate-800 flex items-center justify-center text-slate-400">
                            Missing video source
                          </div>
                        )}
                      </div>
                      <div className="p-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Headset className="w-4 h-4 text-purple-400" />
                            <span className="text-xs text-white font-medium truncate" title={p.vrId}>
                              {p.vrId}
                            </span>
                            <span
                              className={`rounded-full  ${
                                vrOnline
                                  ? "text-emerald-500 bg-emerald-500 animate-pulse"
                                  : "text-red-500 bg-red-500 animate-ping"
                              }`}
                            >
                              <Dot className="w-4 h-4" />
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Armchair className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-white font-medium truncate" title={p.chairId}>
                              {p.chairId}
                            </span>
                            <span
                              className={`rounded-full ${
                                chairOnline
                                  ? "text-emerald-500 bg-emerald-500 animate-pulse"
                                  : "text-red-500 bg-red-500 animate-ping"
                              }`}
                            >
                              <Dot className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                        {setPairs && (
                          <div>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 px-2 py-0 text-xs"
                              onClick={async () => {
                                const sid = activePair?.sessionId;
                                const pid = participantIdByPair[key];
                                if (!sid || !pid) {
                                  console.error(
                                    `[ControllerStep] Cannot unpair: missing sessionId (${sid}) or participantId (${pid})`,
                                  );
                                  console.error(
                                    `[ControllerStep] Available participant mappings:`,
                                    Object.keys(participantIdByPair),
                                  );
                                  console.error(`[ControllerStep] Session pairs:`, sessionPairs.length);
                                  console.error(`[ControllerStep] Current key:`, key);

                                  // Show user-friendly error
                                  if (typeof window !== "undefined") {
                                    window.alert(
                                      `Cannot unpair device: Participant not found. This might be because:\n\n1. The devices aren't properly registered in the database\n2. The session was created without proper device pairing\n\nPlease check the backend logs for more details.`,
                                    );
                                  }
                                  return;
                                }
                                try {
                                  await apiRemoveParticipant(sid, pid);

                                  // Update all related state
                                  setPairs((prev) =>
                                    prev.filter((x) => !(x.vrId === p.vrId && x.chairId === p.chairId)),
                                  );

                                  // Clean up participant mapping
                                  setParticipantIdByPair((prev) => {
                                    const newMap = { ...prev };
                                    delete newMap[key];
                                    return newMap;
                                  });

                                  // Clean up journey selection
                                  setSelectedJourneyByPair((prev) => {
                                    const newMap = { ...prev };
                                    delete newMap[key];
                                    return newMap;
                                  });

                                  // Clean up audio selection
                                  setAudioSel((prev) => {
                                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                    const { [key]: _, ...rest } = prev;
                                    return rest;
                                  });
                                } catch (e) {
                                  console.error(`[ControllerStep] Failed to unpair ${key}:`, e);
                                }
                              }}
                            >
                              Unpair
                            </Button>
                          </div>
                        )}

                        {/* Audio/Language controls */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400">Language:</label>
                          {currentJid ? (
                            tracks.length > 0 ? (
                              <select
                                aria-label="Select audio track"
                                className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2 py-1"
                                value={selSrc}
                                onChange={(e) => {
                                  const selectedUrl = e.target.value;
                                  const selectedTrack = tracks.find((t) => t.url === selectedUrl);
                                  const languageCode = selectedTrack?.language_code || "";

                                  setAudioSel((prev) => ({ ...prev, [key]: selectedUrl }));

                                  // For individual mode, sync language selection to device
                                  if (currentJid && languageCode && activePair?.sessionId) {
                                    const pid = participantIdByPair[key];
                                    if (pid) {
                                      commandParticipant(activePair.sessionId, pid, "select_journey", {
                                        journeyId: Number(currentJid),
                                        language: languageCode,
                                      }).catch((e) => {
                                        console.error(`[ControllerStep] Failed to sync language to device:`, e);
                                      });
                                    }
                                  }
                                }}
                              >
                                {tracks.map((t: { url?: string; language_code?: string }, idx: number) => {
                                  const url = t.url || "";
                                  const label = t.language_code || "";
                                  return (
                                    <option key={`${key}-t-${idx}`} value={url}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-500 italic">No audio tracks available</span>
                            )
                          ) : (
                            <span className="text-xs text-slate-500 italic">Select a journey to choose language</span>
                          )}
                        </div>
                      </div>
                      {/* Participant journey selection (Individual) */}
                      {
                        <div className="px-3 pb-2 pt-2">
                          <div className="text-xs text-slate-400 mb-2">Select Journey:</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {allJourneyCards.map((jc: { jid: number; item: JourneyItem }) => (
                              <button
                                key={`${key}-jc-${jc.jid}`}
                                onClick={() => {
                                  const pid = participantIdByPair[key];
                                  if (!pid || !activePair?.sessionId) return;

                                  // Get selected language for this participant
                                  const selectedAudioUrl = audioSel[key];
                                  const tracks = (jc.item.audio_tracks || []) as {
                                    url?: string;
                                    language_code?: string;
                                  }[];
                                  const selectedTrack = tracks.find((t) => t.url === selectedAudioUrl);
                                  const language = selectedTrack?.language_code || tracks[0]?.language_code || "";

                                  setSelectedJourneyByPair((prev) => ({ ...prev, [key]: jc.jid }));

                                  const newTracks = (jc.item.audio_tracks || []) as {
                                    url?: string;
                                    language_code?: string;
                                  }[];
                                  if (newTracks.length > 0) {
                                    const preferredTrack =
                                      newTracks.find(
                                        (t: { url?: string; language_code?: string }) => t.language_code === language,
                                      ) || newTracks[0];
                                    if (preferredTrack?.url) {
                                      setAudioSel((prev) => ({ ...prev, [key]: preferredTrack.url! }));
                                    }
                                  }

                                  // Send command to device
                                  commandParticipant(activePair.sessionId, pid, "select_journey", {
                                    journeyId: jc.jid,
                                    language: language,
                                  }).catch((e) => {
                                    console.error(`[ControllerStep] Failed to send select_journey:`, e);
                                    // Revert local state on failure
                                    setSelectedJourneyByPair((prev) => {
                                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                      const { [key]: _, ...rest } = prev;
                                      return rest;
                                    });
                                  });
                                }}
                                className={
                                  Number(currentJid) === Number(jc.jid)
                                    ? "px-2 py-1 rounded bg-cyan-700 text-white text-xs"
                                    : "px-2 py-1 rounded bg-slate-700 text-white text-xs hover:bg-slate-600"
                                }
                                title={String(jc.jid)}
                              >
                                <div className="flex items-center gap-2">
                                  <img src={jc.item.video.thumbnail_url} alt="" className="w-6 h-6" />
                                  <span className="truncate max-w-[140px]">{String(jc.item.journey.title)}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      }
                      {/* Current journey info */}
                      {
                        <div className="px-3 pb-2 text-xs text-slate-300">
                          <span className="text-slate-500">Playing:</span>{" "}
                          {(() => {
                            const j = journeys.find(
                              (x) => String(x?.journey?.id ?? x?.video?.id ?? "") === String(currentJid ?? ""),
                            );
                            return j?.journey?.title || j?.video?.title || "-";
                          })()}{" "}
                          <span className="text-slate-500">| Status:</span>{" "}
                          {vrInfo?.status === "active" || chairInfo?.status === "active" ? (
                            <span className="text-green-400">Playing</span>
                          ) : (
                            <span className="text-slate-400">Paused</span>
                          )}
                        </div>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pair Management Modal */}
      <Dialog open={showPairModal} onOpenChange={setShowPairModal}>
        <DialogContent className="max-w-4xl bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">Manage Device Pairs</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Existing Pairs */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Current Pairs ({sessionPairs.length})</h3>
              {sessionPairs.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/30">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No pairs in this session</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sessionPairs.map((pair) => {
                    const key = `${pair.vrId}-${pair.chairId}`;
                    const vrOnline = !!onlineById[pair.vrId];
                    const chairOnline = !!onlineById[pair.chairId];
                    const pid = participantIdByPair[key];

                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800/40"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                              <Headset className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{pair.vrId}</div>
                              <div className="flex items-center gap-1 text-xs">
                                <div className={`w-2 h-2 rounded-full ${vrOnline ? "bg-green-500" : "bg-slate-600"}`} />
                                <span className="text-slate-400">{vrOnline ? "Online" : "Offline"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-slate-500">↔</div>

                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                              <Armchair className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{pair.chairId}</div>
                              <div className="flex items-center gap-1 text-xs">
                                <div
                                  className={`w-2 h-2 rounded-full ${chairOnline ? "bg-green-500" : "bg-slate-600"}`}
                                />
                                <span className="text-slate-400">{chairOnline ? "Online" : "Offline"}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={async () => {
                            if (!pid || !activePair?.sessionId) return;
                            try {
                              await apiRemoveParticipant(activePair.sessionId, pid);
                              // Update local state
                              if (setPairs) {
                                setPairs((prev) => prev.filter((p) => `${p.vrId}-${p.chairId}` !== key));
                              }
                              // Remove from participantId mapping
                              setParticipantIdByPair((prev) => {
                                const newMap = { ...prev };
                                delete newMap[key];
                                return newMap;
                              });
                              // Remove from journey selection
                              setSelectedJourneyByPair((prev) => {
                                const newMap = { ...prev };
                                delete newMap[key];
                                return newMap;
                              });
                            } catch (e) {
                              console.error("Failed to remove pair:", e);
                            }
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add New Pair - Device Selection */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Add New Pair</h3>
              <div className="grid lg:grid-cols-2 gap-4">
                {/* VR Devices */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                      <Headset className="w-3 h-3 text-white" />
                    </div>
                    <h4 className="text-sm font-medium text-white">VR Headsets</h4>
                    <span className="text-xs text-slate-500">({availableVrDevices.length} available)</span>
                  </div>
                  {availableVrDevices.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-lg bg-slate-900/30">
                      <p className="text-slate-500 text-xs">No available VR devices</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableVrDevices.map((d) => {
                        const selected = selectedVrId === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setSelectedVrId(d.id)}
                            className={`w-full text-left border rounded-lg p-2 transition-all ${
                              selected
                                ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20"
                                : "border-slate-700 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-white text-sm">{d.name}</div>
                                <div className="text-xs text-slate-500">{d.id}</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs text-slate-400">Online</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Chair Devices */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                      <Armchair className="w-3 h-3 text-white" />
                    </div>
                    <h4 className="text-sm font-medium text-white">Motion Chairs</h4>
                    <span className="text-xs text-slate-500">({availableChairDevices.length} available)</span>
                  </div>
                  {availableChairDevices.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-lg bg-slate-900/30">
                      <p className="text-slate-500 text-xs">No available chair devices</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableChairDevices.map((d) => {
                        const selected = selectedChairId === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setSelectedChairId(d.id)}
                            className={`w-full text-left border rounded-lg p-2 transition-all ${
                              selected
                                ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/20"
                                : "border-slate-700 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-white text-sm">{d.name}</div>
                                <div className="text-xs text-slate-500">{d.id}</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs text-slate-400">Online</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Pair Button */}
              <div className="mt-4 flex justify-end">
                <Button
                  className="gap-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                  disabled={!selectedVrId || !selectedChairId}
                  onClick={async () => {
                    const sid = activePair?.sessionId;
                    if (!sid || !selectedVrId || !selectedChairId || !setPairs) return;
                    try {
                      const response = await apiAddParticipant(sid, {
                        vrDeviceId: selectedVrId,
                        chairDeviceId: selectedChairId,
                      });
                      const newParticipantId = response?.id;

                      setPairs((prev) => [
                        ...prev,
                        { sessionId: sid, vrId: selectedVrId, chairId: selectedChairId, journeyId: [] },
                      ]);

                      // Add to participantId mapping if we got an ID back
                      if (newParticipantId) {
                        const key = `${selectedVrId}-${selectedChairId}`;
                        setParticipantIdByPair((prev) => ({ ...prev, [key]: String(newParticipantId) }));
                      }

                      setSelectedVrId("");
                      setSelectedChairId("");
                    } catch (e) {
                      console.error("Failed to add pair:", e);
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add Pair
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
