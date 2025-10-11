import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Armchair, Headset, PlayCircle, PauseCircle, ArrowLeft, Dot, CirclePower } from "lucide-react";
import type { JourneyItem } from "@/types/journey";
import { VideoPlayer } from "@/components/media/VideoPlayer";
// removed customCss usage

export type ActivePair = { sessionId: string; vrId: string; chairId: string; journeyId?: number[] } | null;
type Pair = { sessionId: string; vrId: string; chairId: string; journeyId?: number[] };

interface Props {
  activePair: ActivePair;
  journeys: JourneyItem[];
  seekValues: Record<string, number>;
  setSeekValues: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  sendCmd: (sessionId: string, type: "play" | "pause" | "seek" | "stop", positionMs?: number) => void;
  onNewSession: () => void;
  onResendSession?: () => void;
  pairs?: Pair[];
  onlineById?: Record<string, boolean>;
  deviceInfoById?: Record<string, { status?: string; positionMs?: number; sessionId?: string }>;
  lockToExistingSession?: boolean;
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
  onlineById = {},
  deviceInfoById = {},
  lockToExistingSession = false,
  sessionType = null,
}: Props) {
  // Per-participant audio selection state (declare hooks before any early return)
  const [audioSel, setAudioSel] = useState<Record<string, string>>({});
  // console.log(onlineById);

  // For group sessions, collect all pairs in the same session for display
  const sessionPairs = activePair ? pairs.filter((p) => p.sessionId && p.sessionId === activePair.sessionId) : [];
  const journeyIdsAll = (
    Array.isArray(activePair?.journeyId) ? activePair?.journeyId : activePair?.journeyId ? [activePair?.journeyId] : []
  ) as number[];
  const journeyCards = journeyIdsAll
    .map((jid) => ({ jid, item: journeys.find((j) => String(j.journey?.id ?? j.video?.id ?? "") === String(jid)) }))
    .filter((x) => !!x.item) as Array<{ jid: number; item: JourneyItem }>;

  const primaryMedia = journeyCards[0]?.item;
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
  const optimisticRef = useRef(false);
  const manualPausedRef = useRef(false);
  // Optimistic progress after Play is pressed (until devices report active)
  useEffect(() => {
    if (!activePair?.sessionId) return;
    if (isPlaying) {
      optimisticRef.current = false;
      return;
    }
    if (!optimisticRef.current) return;
    const id = setInterval(() => {
      const cur = Number.isFinite(seekValues[activePair.sessionId]) ? seekValues[activePair.sessionId] : 0;
      const next = Math.min(durationMs || 0, cur + 500);
      setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: next }));
      if (next >= (durationMs || 0)) optimisticRef.current = false;
    }, 800);
    return () => clearInterval(id);
  }, [activePair?.sessionId, isPlaying, durationMs, seekValues, setSeekValues, optimisticRef]);

  // Device-driven auto update of slider when playing (disabled if a manual pause is pending)
  useEffect(() => {
    if (!activePair?.sessionId) return;
    if (!isPlaying) return; // paused -> don't progress automatically
    if (manualPausedRef.current) return; // local pause override
    if (dragging) return; // user is dragging -> don't overwrite
    const id = setInterval(() => {
      const vrPos = deviceInfoById[activePair.vrId]?.positionMs;
      const chPos = deviceInfoById[activePair.chairId]?.positionMs;
      const pos = typeof vrPos === "number" ? vrPos : typeof chPos === "number" ? chPos : 0;
      setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: Math.max(0, Math.min(durationMs || 0, pos)) }));
    }, 800);
    return () => clearInterval(id);
  }, [
    activePair?.sessionId,
    activePair?.vrId,
    activePair?.chairId,
    isPlaying,
    dragging,
    durationMs,
    deviceInfoById,
    setSeekValues,
  ]);

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
              <CardTitle className="text-white text-xl mb-1">Session Control</CardTitle>
              <div className="flex items-center gap-3">
                <p className="text-slate-400 text-sm">
                  Session ID: <span className="text-cyan-400 font-mono">{activePair?.sessionId || "-"}</span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 py-0 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                  onClick={onResendSession}
                  title="Resend session ID to all paired devices"
                >
                  Resend Session ID
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={!lockToExistingSession ? onNewSession : undefined}
              disabled={lockToExistingSession}
              title={
                lockToExistingSession ? "An ongoing session is active; cannot start a new one" : "Start a new session"
              }
              className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              New Session
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="grid grid-cols-3 justify-center items-center gap-3 w-[30%]">
              <Button
                onClick={() => {
                  if (!activePair) return;
                  // Start optimistic progress from current value
                  manualPausedRef.current = false;
                  optimisticRef.current = true;
                  sendCmd(activePair.sessionId, "play");
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-base font-semibold"
              >
                <PlayCircle className="w-5 h-5" />
              </Button>
              <Button
                onClick={() => {
                  if (!activePair) return;
                  manualPausedRef.current = true;
                  const cur = Number.isFinite(seekValues[activePair.sessionId]) ? seekValues[activePair.sessionId] : 0;
                  // stop optimistic progression immediately
                  optimisticRef.current = false;
                  sendCmd(activePair.sessionId, "pause", cur);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2 text-base font-semibold"
              >
                <PauseCircle className="w-5 h-5" />
              </Button>
              <Button
                onClick={() => activePair && sendCmd(activePair.sessionId, "stop")}
                variant="destructive"
                className="gap-2 text-base font-semibold"
              >
                <CirclePower className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex items-center gap-3 w-[70%]">
              {activePair && (
                <>
                  <div className="flex-1 flex flex-col gap-1">
                    {/* Hover tooltip */}
                    <div className="relative">
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, durationMs)}
                        step={100}
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
                            sendCmd(activePair.sessionId, "seek", val);
                          }
                          // keep paused; do not auto play after manual seek
                          pausedOnDragRef.current = false;
                        }}
                        onTouchEnd={(ev) => {
                          setDragging(false);
                          const val = Number((ev.target as HTMLInputElement).value || 0);
                          if (activePair) {
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
                        className="pointer-events-none absolute -top-6 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded translate-x-[-50%]"
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{fmtMs(seekValues[activePair.sessionId])}</span>
                      <span>{fmtMs(durationMs)}</span>
                    </div>
                  </div>
                  {/* Resume after manual seek */}
                  {!isPlaying && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 py-0 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                      onClick={() => activePair && sendCmd(activePair.sessionId, "play")}
                    >
                      Resume
                    </Button>
                  )}
                </>
              )}
            </div>
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
                  const vrInfo = deviceInfoById[p.vrId] || {};
                  const chairInfo = deviceInfoById[p.chairId] || {};
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
                  const currentMs =
                    activePair && Number.isFinite(seekValues[activePair.sessionId])
                      ? (seekValues[activePair.sessionId] as number)
                      : 0;
                  return (
                    <div
                      key={`${p.vrId}-${p.chairId}-${i}`}
                      className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden"
                    >
                      <div className="relative">
                        {vSrc ? (
                          <VideoPlayer
                            src={vSrc}
                            className="w-full"
                            isMuted={true}
                            isShowVolume={false}
                            isShowFullscreen={false}
                            externalPlaying={!!isPlaying && !manualPausedRef.current}
                            externalCurrentMs={currentMs}
                          />
                        ) : (
                          <div className="w-full aspect-video bg-black/80 flex items-center justify-center">
                            <PlayCircle className="w-10 h-10 text-slate-700" />
                          </div>
                        )}
                        {/* Device status/time overlay */}
                        <div className="absolute top-2 left-2 space-y-1 text-[10px]">
                          <div className="px-2 py-1 rounded bg-black/60 border border-white/10 text-slate-200 flex items-center gap-1">
                            <Headset className="w-3 h-3 text-purple-300" />
                            <span className="opacity-80">{vrInfo.status ?? "-"}</span>
                            <span className="opacity-60">· {fmtMs(vrInfo.positionMs)}</span>
                          </div>
                          <div className="px-2 py-1 rounded bg-black/60 border border-white/10 text-slate-200 flex items-center gap-1">
                            <Armchair className="w-3 h-3 text-blue-300" />
                            <span className="opacity-80">{chairInfo.status ?? "-"}</span>
                            <span className="opacity-60">· {fmtMs(chairInfo.positionMs)}</span>
                          </div>
                        </div>
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
                          <div className="text-[10px] text-slate-400 ml-6">
                            {vrInfo.status ?? "-"} · {fmtMs(vrInfo.positionMs)}
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
                          <div className="text-[10px] text-slate-400 ml-6">
                            {chairInfo.status ?? "-"} · {fmtMs(chairInfo.positionMs)}
                          </div>
                        </div>
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
