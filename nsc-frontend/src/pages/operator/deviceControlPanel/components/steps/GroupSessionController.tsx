import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Armchair,
  Headset,
  Dot,
  CirclePower,
  Play as PlayIcon,
  Pause as PauseIcon,
  RefreshCw,
  InfoIcon,
  TimerResetIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { JourneyItem } from "@/types/journey";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/media/VideoPlayer";
import { commandSession } from "@/lib/sessions";
import type { BaseControllerProps } from "./types";

export default function GroupSessionController({
  activePair,
  journeys,
  seekValues,
  setSeekValues,
  sendCmd,
  onNewSession,
  onResendSession,
  pairs = [],
  onlineById = {},
  deviceInfoById = {},
  sessionOfflineDevices,
}: BaseControllerProps) {
  const { toast } = useToast();
  const [audioSel, setAudioSel] = useState<Record<string, string>>({});
  const [currentJourneyIdx, setCurrentJourneyIdx] = useState(0);
  const [isSessionPlaying, setIsSessionPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pausedOnDragRef = useRef(false);
  const manualPausedRef = useRef(false);
  const playerRefs = useRef<Record<string, VideoPlayerHandle | null>>({});
  const didInitRef = useRef(false);

  // Collect all pairs in the same session for display
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

  // Toast-based confirmation
  const confirmWithToast = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const t = toast({
        title: "Confirm",
        description: (
          <div className="space-y-3">
            <div className="text-sm text-slate-200">{message}</div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded bg-emerald-600 text-white text-xs"
                onClick={() => {
                  t.dismiss();
                  resolve(true);
                }}
              >
                Confirm
              </button>
              <button
                className="px-3 py-1 rounded bg-slate-700 text-white text-xs"
                onClick={() => {
                  t.dismiss();
                  resolve(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ),
        duration: Infinity,
        style: {
          zIndex: 9999,
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100%",
          maxWidth: "400px",
          padding: "1rem",
          borderRadius: "8px",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
        },
      });
    });
  };

  // Auto-pause session when any device goes offline
  useEffect(() => {
    if (!sessionOfflineDevices || !activePair || !isSessionPlaying) return;

    const offlineDevices = sessionOfflineDevices;

    if (offlineDevices.length > 0) {
      // Get current playback position
      let currentMs = Number.isFinite(seekValues[activePair.sessionId])
        ? (seekValues[activePair.sessionId] as number)
        : 0;
      const anyRef = Object.values(playerRefs.current).find(Boolean);
      if (anyRef && typeof anyRef.getCurrentTimeMs === "function") {
        currentMs = anyRef.getCurrentTimeMs();
      }

      // Pause all players
      sessionPairs.forEach((sp) => {
        const key = `${sp.vrId}-${sp.chairId}`;
        playerRefs.current[key]?.pause?.();
      });

      // Update state
      manualPausedRef.current = true;
      setIsSessionPlaying(false);

      // Send pause command to devices
      const currentJourney = journeyCards[currentJourneyIdx];
      sendCmd(activePair.sessionId, "pause", currentMs, currentJourney?.jid);

      // Notify user
      toast({
        title: "Session Paused",
        description: `Device(s) went offline: ${offlineDevices.join(", ")}. Session has been paused.`,
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [activePair, isSessionPlaying, sessionPairs, seekValues, journeyCards, currentJourneyIdx, sendCmd, toast]);

  // Initialize session
  useEffect(() => {
    if (didInitRef.current) return;
    setCurrentJourneyIdx(0);
    if (activePair) {
      setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
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
        commandSession(activePair.sessionId, "select_journey", { journeyId: target?.jid }).catch((e) => {
          void e;
        });
      }
    }
    didInitRef.current = true;
  }, [activePair, journeyCards, setSeekValues]);

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
                <CardTitle className="text-white text-xl mb-1">Group Session Control</CardTitle>
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
                      If the session ID isn't published to the VR or Motion Chair, click Re-Broadcast to send it again.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                if (!activePair) return;
                const sid = activePair.sessionId;
                sendCmd(sid, "stop");
                if (sid) setSeekValues((prev) => ({ ...prev, [sid]: 0 }));
                onNewSession();
              }}
              variant="destructive"
              className="gap-2 text-base font-semibold"
            >
              <CirclePower className="w-5 h-5" /> Stop Session
            </Button>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-3 w-[100%]">
              {activePair && (
                <>
                  <div className="flex-1 flex items-center gap-3 pointer-events-auto m-2 rounded-md bg-gradient-to-t from-black/70 to-black/10 p-2 backdrop-blur-sm border border-white/10">
                    {!isSessionPlaying ? (
                      <Button
                        disabled={(sessionOfflineDevices?.length ?? 0) > 0}
                        onClick={() => {
                          if (!activePair) return;
                          manualPausedRef.current = false;
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
                        disabled={(sessionOfflineDevices?.length ?? 0) > 0}
                        onClick={() => {
                          if (!activePair) return;
                          manualPausedRef.current = true;
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
                    <div className="relative group w-full">
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, durationMs)}
                        step={100}
                        disabled={(sessionOfflineDevices?.length ?? 0) > 0}
                        value={Number.isFinite(seekValues[activePair.sessionId]) ? seekValues[activePair.sessionId] : 0}
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
                            sessionPairs.forEach((sp) => {
                              const key = `${sp.vrId}-${sp.chairId}`;
                              playerRefs.current[key]?.seekTo?.(val);
                            });
                            const currentJourney = journeyCards[currentJourneyIdx];
                            sendCmd(activePair.sessionId, "seek", val, currentJourney?.jid);
                          }
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
                    <div className="flex items-center justify-center gap-2 py-2 px-1 text-[14px] text-slate-400 w-[100px] text-bold">
                      <span className="flex items-center">
                        {fmtMs(seekValues[activePair.sessionId])} / {fmtMs(durationMs)}
                      </span>
                    </div>
                    <Button
                      onClick={() => {
                        manualPausedRef.current = true;
                        sessionPairs.forEach((sp) => {
                          const key = `${sp.vrId}-${sp.chairId}`;
                          playerRefs.current[key]?.pause?.();
                          playerRefs.current[key]?.seekTo?.(0);
                        });
                        setIsSessionPlaying(false);
                        const currentJourney = journeyCards[currentJourneyIdx];
                        sendCmd(activePair.sessionId, "pause", 0, currentJourney?.jid);
                        sendCmd(activePair.sessionId, "seek", 0, currentJourney?.jid);
                      }}
                      variant="destructive"
                      disabled={(sessionOfflineDevices?.length ?? 0) > 0}
                    >
                      <TimerResetIcon className="w-5 h-5" /> Reset
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Journey Navigation */}
          <div className="flex items-center gap-2 ml-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 py-0 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
              disabled={(sessionOfflineDevices?.length ?? 0) > 0}
              onClick={async () => {
                if (currentJourneyIdx <= 0) return;
                const nextIdx = currentJourneyIdx - 1;
                if (activePair) {
                  const target = journeyCards[nextIdx];
                  const ok = await confirmWithToast(
                    `Switch to journey ${String(target?.jid ?? "")} ? Playback will pause.`,
                  );
                  if (ok && target) {
                    sessionPairs.forEach((sp) => {
                      const key = `${sp.vrId}-${sp.chairId}`;
                      playerRefs.current[key]?.pause?.();
                      playerRefs.current[key]?.seekTo?.(0);
                    });
                    setIsSessionPlaying(false);
                    setCurrentJourneyIdx(nextIdx);
                    setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
                    commandSession(activePair.sessionId, "select_journey", { journeyId: target.jid }).catch((e) => {
                      void e;
                    });
                  }
                }
              }}
            >
              <ArrowLeftIcon className="w-5 h-5" /> Prev
            </Button>
            <div className="flex items-center gap-1">
              {journeyCards.map((jc, idx) => (
                <button
                  key={`jc-${jc.jid}`}
                  disabled={(sessionOfflineDevices?.length ?? 0) > 0}
                  onClick={async () => {
                    if (activePair) {
                      const ok = await confirmWithToast(`Switch to journey ${String(jc.jid)} ? Playback will pause.`);
                      if (ok) {
                        sessionPairs.forEach((sp) => {
                          const key = `${sp.vrId}-${sp.chairId}`;
                          playerRefs.current[key]?.pause?.();
                          playerRefs.current[key]?.seekTo?.(0);
                        });
                        setIsSessionPlaying(false);
                        setCurrentJourneyIdx(idx);
                        setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
                        commandSession(activePair.sessionId, "select_journey", { journeyId: jc.jid }).catch((e) => {
                          void e;
                        });
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
              disabled={(sessionOfflineDevices?.length ?? 0) > 0}
              onClick={async () => {
                if (currentJourneyIdx >= journeyCards.length - 1) return;
                const nextIdx = currentJourneyIdx + 1;
                if (activePair) {
                  const target = journeyCards[nextIdx];
                  const ok = await confirmWithToast(
                    `Switch to journey ${String(target?.jid ?? "")} ? Playback will pause.`,
                  );
                  if (ok && target) {
                    sessionPairs.forEach((sp) => {
                      const key = `${sp.vrId}-${sp.chairId}`;
                      playerRefs.current[key]?.pause?.();
                      playerRefs.current[key]?.seekTo?.(0);
                    });
                    setIsSessionPlaying(false);
                    setCurrentJourneyIdx(nextIdx);
                    setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: 0 }));
                    commandSession(activePair.sessionId, "select_journey", { journeyId: target.jid }).catch(() => {});
                  }
                }
              }}
            >
              <ArrowRightIcon className="w-5 h-5" /> Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 py-0 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => {
                if (!activePair) return;
                const currentJourney = journeyCards[currentJourneyIdx];
                commandSession(activePair.sessionId, "sync", { journeyId: currentJourney?.jid }).catch((e) => {
                  void e;
                });
              }}
              disabled={(sessionOfflineDevices?.length ?? 0) > 0}
            >
              Sync
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* All Participants */}
          {sessionPairs.length > 0 && (
            <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
              <div className="text-white font-semibold mb-3">Devices ({sessionPairs.length})</div>
              <div className="grid sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
                {sessionPairs.map((p, i) => {
                  const vrOnline = !!onlineById[p.vrId];
                  const chairOnline = !!onlineById[p.chairId];
                  const key = `${p.vrId}-${p.chairId}`;

                  const vrInfo = deviceInfoById[p.vrId];
                  const chairInfo = deviceInfoById[p.chairId];

                  const vSrc = primaryMedia?.video?.url || "";
                  const tracks = primaryMedia?.audio_tracks || [];
                  const defaultAudio = tracks[0]?.url || "";
                  const selSrc = audioSel[key] ?? defaultAudio;
                  const seekKey = activePair ? activePair.sessionId : key;

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
                            key={`${key}-${currentCard?.jid}`}
                            ref={(inst: VideoPlayerHandle | null) => {
                              const k = `${p.vrId}-${p.chairId}`;
                              playerRefs.current[k] = inst;
                            }}
                            src={vSrc}
                            className="w-full"
                            isMuted={false}
                            isShowVolume={false}
                            isShowFullscreen={false}
                            isShowPlayPause={false}
                            isShowSeek={false}
                            isShowProgress={false}
                            externalPlaying={vrInfo?.playing || chairInfo?.playing}
                            onTimeUpdateMs={(ms: number) => {
                              if (!activePair?.sessionId) return;
                              if (dragging) return;
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
                              className={`rounded-full ${
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
                                setAudioSel((prev) => ({ ...prev, [key]: selectedUrl }));
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
                          )}
                        </div>
                      </div>
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
