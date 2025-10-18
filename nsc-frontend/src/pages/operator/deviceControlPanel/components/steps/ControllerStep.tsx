import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Armchair,
  Headset,
  PlayCircle,
  Dot,
  CirclePower,
  Play as PlayIcon,
  Pause as PauseIcon,
  RefreshCw,
  InfoIcon,
  Users,
  X,
  Plus,
} from "lucide-react";
import type { JourneyItem } from "@/types/journey";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/media/VideoPlayer";
import {
  commandSession,
  commandParticipant,
  getSessionById,
  addParticipant as apiAddParticipant,
  removeParticipant as apiRemoveParticipant,
  type SessionDetailsEnvelope,
} from "@/lib/sessions";
// removed customCss usage

export type ActivePair = { sessionId: string; vrId: string; chairId: string; journeyId?: number[] } | null;
type Pair = { sessionId: string; vrId: string; chairId: string; journeyId?: number[] };
type Device = { id: string; name: string; online: boolean; type?: string };

interface Props {
  activePair: ActivePair;
  journeys: JourneyItem[];
  seekValues: Record<string, number>;
  setSeekValues: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  sendCmd: (sessionId: string, type: "play" | "pause" | "seek" | "stop", positionMs?: number, journeyId?: number) => void;
  sendParticipantCmd?: (
    pair: { vrId: string; chairId: string },
    type: "play" | "pause" | "seek" | "stop",
    positionMs?: number,
  ) => void;
  onNewSession: () => void;
  onResendSession?: () => void;
  pairs?: Pair[];
  setPairs?: (updater: (prev: Pair[]) => Pair[]) => void;
  onlineById?: Record<string, boolean>;
  deviceInfoById?: Record<string, { status?: string; positionMs?: number; sessionId?: string; currentJourneyId?: number; lastEvent?: string }>;
  vrDevices?: Device[];
  chairDevices?: Device[];
  sessionType?: "individual" | "group" | null;
}

export default function ControllerStep({
  activePair,
  journeys,
  seekValues,
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
  sessionType = null,
  sendParticipantCmd,
}: Props) {
  // Per-participant audio selection state (declare hooks before any early return)
  const [audioSel, setAudioSel] = useState<Record<string, string>>({});
  const [currentJourneyIdx, setCurrentJourneyIdx] = useState(0);
  const [isSessionPlaying, setIsSessionPlaying] = useState(false);
  
  // Debug logging
  console.log('[ControllerStep] sessionType:', sessionType, 'pairs:', pairs.length, 'activePair:', activePair?.sessionId);

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

  const currentCard = journeyCards[currentJourneyIdx] || journeyCards[0];
  const primaryMedia = currentCard?.item;
  const durationMs = Number(primaryMedia?.video?.duration_ms || 0);
  const fmtMs = (ms?: number) => {
    const n = Math.max(0, Math.floor((ms || 0) / 1000));
    const s = n % 60;
    const m = Math.floor(n / 60) % 60;
    const h = Math.floor(n / 3600);
    const pad = (x: number) => x.toString().padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  };

  // Determine playing/paused from device statuses
  const vrInfoActive = activePair ? deviceInfoById[activePair.vrId]?.status === "active" : false;
  const chairInfoActive = activePair ? deviceInfoById[activePair.chairId]?.status === "active" : false;
  const isPlaying = vrInfoActive || chairInfoActive;
  // Slider drag state to avoid fighting auto updates while user is dragging
  const [dragging, setDragging] = useState(false);
  const pausedOnDragRef = useRef(false);
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
  const availableChairDevices = useMemo(() => chairDevices.filter((d) => !pairedChairIds.has(d.id)), [chairDevices, pairedChairIds]);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    setCurrentJourneyIdx(0);
    if (activePair) {
      setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
      // For group sessions, default-select the first journey across the group
      if (sessionType === "group") {
        const journeyIdsAlls = (
          Array.isArray(activePair?.journeyId)
            ? activePair?.journeyId
            : activePair?.journeyId
            ? [activePair?.journeyId]
            : []
        ) as number[];
        sessionPairs.forEach((sp) => {
          const key = `${sp.vrId}-${sp.chairId}`;
          playerRefs.current[key]?.pause?.();
          playerRefs.current[key]?.seekTo?.(0);
        });
        if (journeyIdsAlls.length > 0) {
          const target = journeyCards[0];
          commandSession(activePair.sessionId, "select_journey", { journeyId: target?.jid }).catch(() => {});
        }
      }
    }
    didInitRef.current = true;
  }, [activePair, journeyCards, sessionPairs, sessionType, setSeekValues]);

  // Build participantId mapping for Individual sessions
  useEffect(() => {
    const sid = activePair?.sessionId;
    if (!sid || sessionType !== "individual") return;
    const load = async () => {
      try {
        const res: SessionDetailsEnvelope = await getSessionById(sid);
        const parts = res?.data?.participants || [];
        const map: Record<string, string> = {};
        parts.forEach((m) => {
          const vr = String(m.vr_device_id || "");
          const ch = String(m.chair_device_id || "");
          const pid = String(m.id || "");
          const jid = m.journey_id;
          if (vr && ch && pid) {
            map[`${vr}-${ch}`] = pid;
            // Load journey from backend if exists
            if (jid != null && !selectedJourneyByPair[`${vr}-${ch}`]) {
              setSelectedJourneyByPair((prev) => ({ ...prev, [`${vr}-${ch}`]: Number(jid) }));
            }
          }
        });
        setParticipantIdByPair(map);
      } catch (e) {
        void e;
      }
    };
    void load();
  }, [activePair?.sessionId, sessionType, sessionPairs.length, selectedJourneyByPair]);

  // Clear manual pause override once devices report not playing
  useEffect(() => {
    if (!isPlaying) manualPausedRef.current = false;
  }, [isPlaying]);

  // Console log device events for debugging
  useEffect(() => {
    sessionPairs.forEach((p) => {
      const vrInfo = deviceInfoById[p.vrId];
      const chairInfo = deviceInfoById[p.chairId];
      if (vrInfo?.lastEvent) {
        console.log(`[ControllerStep] VR ${p.vrId} event: ${vrInfo.lastEvent}, journey: ${vrInfo.currentJourneyId}, pos: ${vrInfo.positionMs}ms, status: ${vrInfo.status}`);
      }
      if (chairInfo?.lastEvent) {
        console.log(`[ControllerStep] Chair ${p.chairId} event: ${chairInfo.lastEvent}, journey: ${chairInfo.currentJourneyId}, pos: ${chairInfo.positionMs}ms, status: ${chairInfo.status}`);
      }
    });
  }, [deviceInfoById, sessionPairs]);

  // Sync device-selected journey to UI state for Individual sessions
  useEffect(() => {
    if (sessionType !== "individual") return;
    sessionPairs.forEach((p) => {
      const key = `${p.vrId}-${p.chairId}`;
      const vrInfo = deviceInfoById[p.vrId];
      const chairInfo = deviceInfoById[p.chairId];
      const deviceJourneyId = vrInfo?.currentJourneyId ?? chairInfo?.currentJourneyId;
      if (deviceJourneyId != null && selectedJourneyByPair[key] !== deviceJourneyId) {
        console.log(`[ControllerStep] Syncing device-selected journey for ${key}: ${deviceJourneyId}`);
        setSelectedJourneyByPair((prev) => ({ ...prev, [key]: deviceJourneyId }));
      }
    });
  }, [deviceInfoById, sessionPairs, sessionType, selectedJourneyByPair]);
  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-white text-xl mb-1">Session Control</CardTitle>
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
              {sessionType === "individual" && (
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
              )}
            </div>

            <Button
              onClick={() => {
                if (!activePair) return;
                sendCmd(activePair.sessionId, "stop");
                onNewSession();
              }}
              variant="destructive"
              className="gap-2 text-base font-semibold"
            >
              <CirclePower className="w-5 h-5" /> Stop Session
            </Button>
          </div>
          {sessionType === "group" && (
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-3 w-[100%]">
                {activePair && (
                  <>
                    <div className="flex-1 flex items-center gap-3 pointer-events-auto m-2 rounded-md bg-gradient-to-t from-black/70 to-black/10 p-2 backdrop-blur-sm border border-white/10">
                      {!isSessionPlaying ? (
                        <Button
                          onClick={() => {
                            if (!activePair) return;
                            manualPausedRef.current = false;
                            // locally start playback for all visible players of this session for smoother UX
                            sessionPairs.forEach((sp) => {
                              const key = `${sp.vrId}-${sp.chairId}`;
                              playerRefs.current[key]?.play?.();
                            });
                            setIsSessionPlaying(true);
                            const currentJourney = journeyCards[currentJourneyIdx];
                            sendCmd(activePair.sessionId, "play", 0, currentJourney?.jid);
                          }}
                          className="inline-flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white"
                        >
                          <PlayIcon className="w-5 h-5" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            if (!activePair) return;
                            manualPausedRef.current = true;
                            // pause locally and send pause with current time from any player if available
                            let currentMs = Number.isFinite(seekValues[activePair.sessionId])
                              ? (seekValues[activePair.sessionId] as number)
                              : 0;
                            const anyRef = Object.values(playerRefs.current).find(Boolean);
                            if (anyRef && typeof anyRef.getCurrentTimeMs === "function") {
                              currentMs = anyRef.getCurrentTimeMs();
                            }
                            sessionPairs.forEach((sp) => {
                              const key = `${sp.vrId}-${sp.chairId}`;
                              playerRefs.current[key]?.pause?.();
                            });
                            setIsSessionPlaying(false);
                            const currentJourney = journeyCards[currentJourneyIdx];
                            sendCmd(activePair.sessionId, "pause", currentMs, currentJourney?.jid);
                          }}
                          className="inline-flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white"
                        >
                          <PauseIcon className="w-5 h-5" />
                        </Button>
                      )}
                      {/* Hover tooltip */}
                      <div className="relative group w-full">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, durationMs)}
                          step={100}
                          value={
                            Number.isFinite(seekValues[activePair.sessionId]) ? seekValues[activePair.sessionId] : 0
                          }
                          onChange={(ev) => {
                            const val = Number(ev.target.value || 0);
                            setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: val }));
                          }}
                          onMouseDown={() => {
                            setDragging(true);
                            if (isPlaying && activePair) {
                              pausedOnDragRef.current = true;
                              sendCmd(activePair.sessionId, "pause");
                            }
                          }}
                          onTouchStart={() => {
                            setDragging(true);
                            if (isPlaying && activePair) {
                              pausedOnDragRef.current = true;
                              sendCmd(activePair.sessionId, "pause");
                            }
                          }}
                          onMouseUp={(ev) => {
                            setDragging(false);
                            const val = Number((ev.target as HTMLInputElement).value || 0);
                            if (activePair) {
                              // seek local players for this session for immediate feedback
                              sessionPairs.forEach((sp) => {
                                const key = `${sp.vrId}-${sp.chairId}`;
                                playerRefs.current[key]?.seekTo?.(val);
                              });
                              const currentJourney = journeyCards[currentJourneyIdx];
                              sendCmd(activePair.sessionId, "seek", val, currentJourney?.jid);
                            }
                            // keep paused; do not auto play after manual seek
                            pausedOnDragRef.current = false;
                          }}
                          onTouchEnd={(ev) => {
                            setDragging(false);
                            const val = Number((ev.target as HTMLInputElement).value || 0);
                            if (activePair) {
                              sessionPairs.forEach((sp) => {
                                const key = `${sp.vrId}-${sp.chairId}`;
                                playerRefs.current[key]?.seekTo?.(val);
                              });
                              const currentJourney = journeyCards[currentJourneyIdx];
                              sendCmd(activePair.sessionId, "seek", val, currentJourney?.jid);
                            }
                            // keep paused; do not auto play after manual seek
                            pausedOnDragRef.current = false;
                          }}
                          onMouseMove={(ev) => {
                            const input = ev.currentTarget as HTMLInputElement;
                            const rect = input.getBoundingClientRect();
                            const x = Math.min(Math.max(ev.clientX - rect.left, 0), rect.width);
                            const pct = rect.width > 0 ? x / rect.width : 0;
                            const ms = Math.floor(pct * (durationMs || 0));
                            const tip = input.parentElement?.querySelector("[data-tip]") as HTMLDivElement | null;
                            if (tip) {
                              tip.style.left = `${x}px`;
                              tip.textContent = fmtMs(ms);
                            }
                          }}
                          className="w-full accent-cyan-500"
                          aria-label="Seek position"
                        />
                        <div
                          data-tip
                          className="pointer-events-none absolute -top-6 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded translate-x-[-50%] group-hover:block hidden"
                        ></div>
                      </div>
                      <div className="flex items-center justify-center gap-2 py-2 px-1 text-[14px] text-slate-400  w-[100px] text-bold ">
                        <span className="flex items-center">
                          {fmtMs(seekValues[activePair.sessionId])} / {fmtMs(durationMs)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {sessionType === "group" && (
            <div className="flex items-center gap-2 ml-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 py-0 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => {
                  if (currentJourneyIdx <= 0) return;
                  const nextIdx = currentJourneyIdx - 1;
                  if (activePair) {
                    const target = journeyCards[nextIdx];
                    const ok =
                      typeof window !== "undefined"
                        ? window.confirm(`Switch to journey ${String(target?.jid ?? "")}? Playback will pause.`)
                        : true;
                    if (ok && target) {
                      // Pause all players and reset to 0
                      sessionPairs.forEach((sp) => {
                        const key = `${sp.vrId}-${sp.chairId}`;
                        playerRefs.current[key]?.pause?.();
                        playerRefs.current[key]?.seekTo?.(0);
                      });
                      setIsSessionPlaying(false);
                      setCurrentJourneyIdx(nextIdx);
                      setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
                      // Send select_journey with pause
                      commandSession(activePair.sessionId, "select_journey", { journeyId: target.jid }).catch(() => {});
                    }
                  }
                }}
              >
                Prev
              </Button>
              <div className="flex items-center gap-1">
                {journeyCards.map((jc, idx) => (
                  <button
                    key={`jc-${jc.jid}`}
                    onClick={() => {
                      if (activePair) {
                        const ok =
                          typeof window !== "undefined" ? window.confirm(`Switch to journey ${String(jc.jid)}? Playback will pause.`) : true;
                        if (ok) {
                          // Pause all players and reset to 0
                          sessionPairs.forEach((sp) => {
                            const key = `${sp.vrId}-${sp.chairId}`;
                            playerRefs.current[key]?.pause?.();
                            playerRefs.current[key]?.seekTo?.(0);
                          });
                          setIsSessionPlaying(false);
                          setCurrentJourneyIdx(idx);
                          setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
                          // Send select_journey with pause
                          commandSession(activePair.sessionId, "select_journey", { journeyId: jc.jid }).catch(() => {});
                        }
                      }
                    }}
                    className={
                      idx < currentJourneyIdx
                        ? "px-2 py-1 rounded bg-emerald-700 text-white text-xs"
                        : idx === currentJourneyIdx
                        ? "px-2 py-1 rounded bg-cyan-700 text-white text-xs"
                        : "px-2 py-1 rounded bg-slate-700 text-white text-xs"
                    }
                    title={String(jc.jid)}
                  >
                    <div className="flex items-center gap-2">
                      <img src={jc.item.video.thumbnail_url} alt="" className="w-8 h-8" />
                      {String(jc.item.journey.title)}
                    </div>
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 py-0 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => {
                  if (currentJourneyIdx >= journeyCards.length - 1) return;
                  const nextIdx = currentJourneyIdx + 1;
                  if (activePair) {
                    const target = journeyCards[nextIdx];
                    const ok =
                      typeof window !== "undefined"
                        ? window.confirm(`Switch to journey ${String(target?.jid ?? "")}? Playback will pause.`)
                        : true;
                    if (ok && target) {
                      // Pause all players and reset to 0
                      sessionPairs.forEach((sp) => {
                        const key = `${sp.vrId}-${sp.chairId}`;
                        playerRefs.current[key]?.pause?.();
                        playerRefs.current[key]?.seekTo?.(0);
                      });
                      setIsSessionPlaying(false);
                      setCurrentJourneyIdx(nextIdx);
                      setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
                      // Send select_journey with pause
                      commandSession(activePair.sessionId, "select_journey", { journeyId: target.jid }).catch(() => {});
                    }
                  }
                }}
              >
                Next
              </Button>
            </div>
          )}
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
                  const currentJid =
                    deviceJourneyId ??
                    selectedJourneyByPair[key] ??
                    (Array.isArray(p.journeyId) ? p.journeyId[0] : p.journeyId);
                  
                  // Media item: shared (group) or per-participant (individual with device-selected journey)
                  const mediaItem =
                    sessionType === "group"
                      ? primaryMedia
                      : journeys.find((j) => String(j.journey?.id ?? j.video?.id ?? "") === String(currentJid ?? ""));

                  const vSrc = mediaItem?.video?.url || "";
                  const tracks = mediaItem?.audio_tracks || [];
                  const defaultAudio = tracks[0]?.url || "";
                  const selSrc = audioSel[key] ?? defaultAudio;
                  const seekKey = sessionType === "group" && activePair ? activePair.sessionId : key;
                  const allJourneyCards = journeys
                    .map((j) => ({ jid: Number(j?.journey?.id ?? j?.video?.id), item: j }))
                    .filter((x) => Number.isFinite(x.jid)) as Array<{ jid: number; item: JourneyItem }>;
                  return (
                    <div
                      key={`${p.vrId}-${p.chairId}-${i}`}
                      className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden"
                    >
                      <div className="relative">
                        {vSrc ? (
                          <VideoPlayer
                            key={`${key}-${currentJid}`}
                            ref={(inst: VideoPlayerHandle | null) => {
                              const k = `${p.vrId}-${p.chairId}`;
                              playerRefs.current[k] = inst;
                            }}
                            src={vSrc}
                            className="w-full"
                            isMuted={true}
                            isShowVolume={true}
                            isShowFullscreen={true}
                            externalPlaying={vrInfo?.status === "active" || chairInfo?.status === "active"}
                            ontogglePlay={(playing: boolean) => {
                              if (!sendParticipantCmd) return;
                              if (playing) {
                                sendParticipantCmd({ vrId: p.vrId, chairId: p.chairId }, "play");
                              } else {
                                const currentMs = playerRefs.current[key]?.getCurrentTimeMs() || 0;
                                sendParticipantCmd({ vrId: p.vrId, chairId: p.chairId }, "pause", currentMs);
                              }
                            }}
                            onSeekEnd={(ms: number) => {
                              if (!sendParticipantCmd) return;
                              console.log(`[ControllerStep] Admin seeking to ${ms}ms for ${key}`);
                              sendParticipantCmd({ vrId: p.vrId, chairId: p.chairId }, "seek", ms);
                            }}
                            onTimeUpdateMs={(ms: number) => {
                              if (!activePair?.sessionId) return;
                              if (dragging) return;
                              const clamped = Math.max(0, Math.min(durationMs || 0, Math.floor(ms || 0)));
                              setSeekValues((prev) => ({ ...prev, [seekKey]: clamped }));
                            }}
                          />
                        ) : (
                          <div className="w-full aspect-video bg-black/80 flex items-center justify-center">
                            <PlayCircle className="w-10 h-10 text-slate-700" />
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
                        {sessionType === "individual" && setPairs && (
                          <div>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 px-2 py-0 text-xs"
                              onClick={async () => {
                                const sid = activePair?.sessionId;
                                const pid = participantIdByPair[key];
                                if (!sid || !pid) return;
                                try {
                                  await apiRemoveParticipant(sid, pid);
                                  setPairs((prev) =>
                                    prev.filter((x) => !(x.vrId === p.vrId && x.chairId === p.chairId)),
                                  );
                                } catch (e) {
                                  void e;
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
                          {tracks.length > 0 ? (
                            <select
                              aria-label="Select audio track"
                              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2 py-1"
                              value={selSrc}
                              onChange={(e) => {
                                const selectedUrl = e.target.value;
                                const selectedTrack = tracks.find((t) => t.url === selectedUrl);
                                const languageCode = selectedTrack?.language_code || "";
                                
                                setAudioSel((prev) => ({ ...prev, [key]: selectedUrl }));
                                
                                // For individual mode, language selection per journey
                                if (sessionType === "individual" && currentJid && languageCode) {
                                  console.log(`[ControllerStep] Language selected for journey ${currentJid}: ${languageCode}`);
                                }
                              }}
                            >
                              {tracks.map((t, idx) => {
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
                          )}
                        </div>
                      </div>
                      {/* Participant journey selection (Individual) */}
                      {sessionType === "individual" && (
                        <div className="px-3 pb-2 pt-2">
                          <div className="text-xs text-slate-400 mb-2">Select Journey:</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {allJourneyCards.map((jc) => (
                              <button
                                key={`${key}-jc-${jc.jid}`}
                                onClick={() => {
                                  const pid = participantIdByPair[key];
                                  if (!pid || !activePair?.sessionId) return;
                                  
                                  // Get selected language for this participant
                                  const selectedAudioUrl = audioSel[key];
                                  const tracks = (jc.item.audio_tracks || []) as { url?: string; language_code?: string }[];
                                  const selectedTrack = tracks.find((t) => t.url === selectedAudioUrl);
                                  const language = selectedTrack?.language_code || tracks[0]?.language_code || "";
                                  
                                  console.log(`[ControllerStep] Admin selecting journey ${jc.jid} for participant ${pid} (${key}) with language: ${language}`);
                                  commandParticipant(activePair.sessionId, pid, "select_journey", {
                                    journeyId: jc.jid,
                                    language: language,
                                  }).catch((e) => {
                                    console.error(`[ControllerStep] Failed to send select_journey:`, e);
                                  });
                                  setSelectedJourneyByPair((prev) => ({ ...prev, [key]: jc.jid }));
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
                      )}
                      {/* Current journey info */}
                      {sessionType === "individual" && (
                        <div className="px-3 pb-2 text-xs text-slate-300">
                          <span className="text-slate-500">Playing:</span>{" "}
                          {(() => {
                            const j = journeys.find(
                              (x) => String(x?.journey?.id ?? x?.video?.id ?? "") === String(currentJid ?? ""),
                            );
                            return j?.journey?.title || j?.video?.title || "-";
                          })()}
                          {" "}
                          <span className="text-slate-500">|
                          Status:</span> {vrInfo?.status === "active" || chairInfo?.status === "active" ? (
                            <span className="text-green-400">Playing</span>
                          ) : (
                            <span className="text-slate-400">Paused</span>
                          )}
                        </div>
                      )}
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
                                <div className={`w-2 h-2 rounded-full ${chairOnline ? "bg-green-500" : "bg-slate-600"}`} />
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
                              console.log(`[ControllerStep] Removing participant ${pid} (${key})`);
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
                      console.log(`[ControllerStep] Adding pair ${selectedVrId}-${selectedChairId}`);
                      const response = await apiAddParticipant(sid, { vrDeviceId: selectedVrId, chairDeviceId: selectedChairId });
                      const newParticipantId = response?.id;
                      
                      setPairs((prev) => [
                        ...prev,
                        { sessionId: sid, vrId: selectedVrId, chairId: selectedChairId, journeyId: [] },
                      ]);
                      
                      // Add to participantId mapping if we got an ID back
                      if (newParticipantId) {
                        const key = `${selectedVrId}-${selectedChairId}`;
                        setParticipantIdByPair((prev) => ({ ...prev, [key]: String(newParticipantId) }));
                        console.log(`[ControllerStep] Mapped ${key} to participant ${newParticipantId}`);
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
