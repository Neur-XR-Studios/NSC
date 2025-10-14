import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Armchair,
  Headset,
  PlayCircle,
  Dot,
  CirclePower,
  PlayIcon,
  PauseIcon,
  RefreshCw,
  InfoIcon,
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

interface Props {
  activePair: ActivePair;
  journeys: JourneyItem[];
  seekValues: Record<string, number>;
  setSeekValues: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  sendCmd: (sessionId: string, type: "play" | "pause" | "seek" | "stop", positionMs?: number) => void;
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
  deviceInfoById?: Record<string, { status?: string; positionMs?: number; sessionId?: string }>;
  // lockToExistingSession?: boolean;
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
  // lockToExistingSession = false,
  sessionType = null,
  sendParticipantCmd,
}: Props) {
  // Per-participant audio selection state (declare hooks before any early return)
  console.log("activePair", pairs);
  const [audioSel, setAudioSel] = useState<Record<string, string>>({});
  const [currentJourneyIdx, setCurrentJourneyIdx] = useState(0);
  const [isSessionPlaying, setIsSessionPlaying] = useState(false);
  // console.log(onlineById);

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
  const [newVrId, setNewVrId] = useState("");
  const [newChairId, setNewChairId] = useState("");

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
          if (vr && ch && pid) map[`${vr}-${ch}`] = pid;
        });
        setParticipantIdByPair(map);
      } catch (e) {
        void e;
      }
    };
    void load();
  }, [activePair?.sessionId, sessionType]);

  // Clear manual pause override once devices report not playing
  useEffect(() => {
    if (!isPlaying) manualPausedRef.current = false;
  }, [isPlaying]);
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
                <div className="mt-3 flex items-end gap-2">
                  <div>
                    <div className="text-xs text-slate-400">Add Pair - VR ID</div>
                    <input
                      value={newVrId}
                      onChange={(e) => setNewVrId(e.target.value)}
                      placeholder="VR_..."
                      className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Chair ID</div>
                    <input
                      value={newChairId}
                      onChange={(e) => setNewChairId(e.target.value)}
                      placeholder="CHAIR_..."
                      className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2 py-1"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 py-0 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                    onClick={async () => {
                      const sid = activePair?.sessionId;
                      if (!sid || !newVrId || !newChairId || !setPairs) return;
                      try {
                        await apiAddParticipant(sid, { vrDeviceId: newVrId, chairDeviceId: newChairId });
                        setPairs((prev) => [
                          ...prev,
                          { sessionId: sid, vrId: newVrId, chairId: newChairId, journeyId: [] },
                        ]);
                        setNewVrId("");
                        setNewChairId("");
                      } catch (e) {
                        void e;
                      }
                    }}
                  >
                    Add Pair
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
                            sendCmd(activePair.sessionId, "play");
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
                            sendCmd(activePair.sessionId, "pause", currentMs);
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
                              sendCmd(activePair.sessionId, "seek", val);
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
                              sendCmd(activePair.sessionId, "seek", val);
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
                        ? window.confirm(`Switch to journey ${String(target?.jid ?? "")}?`)
                        : true;
                    if (ok && target) {
                      commandSession(activePair.sessionId, "select_journey", { journeyId: target.jid }).catch(() => {});
                    }
                    setCurrentJourneyIdx(nextIdx);
                    setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
                    sessionPairs.forEach((sp) => {
                      const key = `${sp.vrId}-${sp.chairId}`;
                      playerRefs.current[key]?.pause?.();
                      playerRefs.current[key]?.seekTo?.(0);
                    });
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
                          typeof window !== "undefined" ? window.confirm(`Switch to journey ${String(jc.jid)}?`) : true;
                        if (ok) {
                          commandSession(activePair.sessionId, "select_journey", { journeyId: jc.jid }).catch(() => {});
                        }
                        setCurrentJourneyIdx(idx);
                        setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
                        sessionPairs.forEach((sp) => {
                          const key = `${sp.vrId}-${sp.chairId}`;
                          playerRefs.current[key]?.pause?.();
                          playerRefs.current[key]?.seekTo?.(0);
                        });
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
                        ? window.confirm(`Switch to journey ${String(target?.jid ?? "")}?`)
                        : true;
                    if (ok && target) {
                      commandSession(activePair.sessionId, "select_journey", { journeyId: target.jid }).catch(() => {});
                      setCurrentJourneyIdx(nextIdx);
                      setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
                      sessionPairs.forEach((sp) => {
                        const key = `${sp.vrId}-${sp.chairId}`;
                        playerRefs.current[key]?.pause?.();
                        playerRefs.current[key]?.seekTo?.(0);
                      });
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
                  // Media item: shared (group) or per-participant (individual)
                  const mediaItem =
                    sessionType === "group"
                      ? primaryMedia
                      : (() => {
                          const jid = Array.isArray(p.journeyId) ? p.journeyId[0] : p.journeyId;
                          return journeys.find((j) => String(j.journey?.id ?? j.video?.id ?? "") === String(jid ?? ""));
                        })();

                  const vSrc = mediaItem?.video?.url || "";
                  const tracks = mediaItem?.audio_tracks || [];
                  const defaultAudio = tracks[0]?.url || "";
                  const selSrc = audioSel[key] ?? defaultAudio;
                  const seekKey = sessionType === "group" && activePair ? activePair.sessionId : key;
                  const allJourneyCards = journeys
                    .map((j) => ({ jid: Number(j?.journey?.id ?? j?.video?.id), item: j }))
                    .filter((x) => Number.isFinite(x.jid)) as Array<{ jid: number; item: JourneyItem }>;
                  const currentJid =
                    selectedJourneyByPair[key] ?? (Array.isArray(p.journeyId) ? p.journeyId[0] : p.journeyId);
                  return (
                    <div
                      key={`${p.vrId}-${p.chairId}-${i}`}
                      className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden"
                    >
                      <div className="relative">
                        {vSrc ? (
                          <VideoPlayer
                            ref={(inst: VideoPlayerHandle | null) => {
                              const k = `${p.vrId}-${p.chairId}`;
                              playerRefs.current[k] = inst;
                            }}
                            src={vSrc}
                            className="w-full"
                            isMuted={true}
                            isShowVolume={false}
                            isShowFullscreen={false}
                            externalPlaying={!!isPlaying && !manualPausedRef.current}
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

                        {/* Audio controls */}
                        {tracks.length > 0 && (
                          <div className="flex items-center gap-2">
                            <select
                              aria-label="Select audio track"
                              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2 py-1"
                              value={selSrc}
                              onChange={(e) => setAudioSel((prev) => ({ ...prev, [key]: e.target.value }))}
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
                          </div>
                        )}
                      </div>
                      {/* Participant journey selection (Individual) */}
                      {sessionType === "individual" && (
                        <div className="px-3 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {allJourneyCards.map((jc) => (
                              <button
                                key={`${key}-jc-${jc.jid}`}
                                onClick={() => {
                                  const pid = participantIdByPair[key];
                                  if (!pid || !activePair?.sessionId) return;
                                  commandParticipant(activePair.sessionId, pid, "select_journey", {
                                    journeyId: jc.jid,
                                  }).catch(() => {});
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
                      {/* Current journey banner */}
                      {sessionType === "individual" && (
                        <div className="px-3 pb-3 text-xs text-slate-300">
                          Journey:{" "}
                          {(() => {
                            const j = journeys.find(
                              (x) => String(x?.journey?.id ?? x?.video?.id ?? "") === String(currentJid ?? ""),
                            );
                            return j?.journey?.title || j?.video?.title || "-";
                          })()}
                        </div>
                      )}
                      {sessionType === "individual" && (
                        <div className="px-3 pb-3 flex items-center gap-2">
                          <Button
                            onClick={() => {
                              if (!sendParticipantCmd) return;
                              sendParticipantCmd({ vrId: p.vrId, chairId: p.chairId }, "play");
                            }}
                            className="inline-flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white h-8 px-2"
                          >
                            <PlayIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              if (!sendParticipantCmd) return;
                              const pos = Number.isFinite(seekValues[seekKey]) ? seekValues[seekKey] : 0;
                              sendParticipantCmd({ vrId: p.vrId, chairId: p.chairId }, "pause", pos);
                            }}
                            className="inline-flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white h-8 px-2"
                          >
                            <PauseIcon className="w-4 h-4" />
                          </Button>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(0, durationMs)}
                            step={100}
                            value={Number.isFinite(seekValues[seekKey]) ? seekValues[seekKey] : 0}
                            onChange={(ev) => {
                              const val = Number(ev.target.value || 0);
                              setSeekValues((prev) => ({ ...prev, [seekKey]: val }));
                            }}
                            onMouseUp={(ev) => {
                              const val = Number((ev.target as HTMLInputElement).value || 0);
                              if (sendParticipantCmd) {
                                sendParticipantCmd({ vrId: p.vrId, chairId: p.chairId }, "seek", val);
                              }
                            }}
                            className="w-full accent-cyan-500"
                            aria-label="Seek position (participant)"
                          />
                          <span className="text-xs text-slate-400">{fmtMs(seekValues[seekKey])}</span>
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
    </div>
  );
}
