import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Armchair,
  Headset,
  PlayCircle,
  PauseCircle,
  StopCircle,
  SkipForward,
  ArrowLeft,
  Dot,
  CirclePower,
  RotateCcw,
} from "lucide-react";
import type { JourneyItem } from "@/types/journey";
import { VideoPlayer } from "@/components/media/VideoPlayer";

export type ActivePair = { sessionId: string; vrId: string; chairId: string; journeyId?: number[] } | null;
type Pair = { sessionId: string; vrId: string; chairId: string; journeyId?: number[] };

interface Props {
  activePair: ActivePair;
  journeys: JourneyItem[];
  seekValues: Record<string, number>;
  setSeekValues: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  sendCmd: (sessionId: string, type: "play" | "pause" | "seek" | "stop", positionMs?: number) => void;
  onNewSession: () => void;
  pairs?: Pair[];
  onlineById?: Record<string, boolean>;
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
  pairs = [],
  onlineById = {},
  lockToExistingSession = false,
  sessionType = null,
}: Props) {
  // Per-participant audio selection state (declare hooks before any early return)
  const [audioSel, setAudioSel] = useState<Record<string, string>>({});
  // console.log(onlineById);
  if (!activePair) return null;

  // For group sessions, collect all pairs in the same session for display
  const sessionPairs = pairs.filter((p) => p.sessionId && p.sessionId === activePair.sessionId);
  const journeyIdsAll = (
    Array.isArray(activePair.journeyId) ? activePair.journeyId : activePair.journeyId ? [activePair.journeyId] : []
  ) as number[];
  const journeyCards = journeyIdsAll
    .map((jid) => ({ jid, item: journeys.find((j) => String(j.journey?.id ?? j.video?.id ?? "") === String(jid)) }))
    .filter((x) => !!x.item) as Array<{ jid: number; item: JourneyItem }>;

  const primaryMedia = journeyCards[0]?.item;

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-xl mb-1">Session Control</CardTitle>
              <p className="text-slate-400 text-sm">
                Session ID: <span className="text-cyan-400 font-mono">{activePair.sessionId}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid grid-cols-4 justify-center items-center gap-3">
                <Button
                  onClick={() => sendCmd(activePair.sessionId, "play")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-base font-semibold"
                >
                  <PlayCircle className="w-5 h-5" />
                </Button>
                <Button
                  onClick={() => sendCmd(activePair.sessionId, "pause")}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-2 text-base font-semibold"
                >
                  <PauseCircle className="w-5 h-5" />
                </Button>
                <Button
                  onClick={() => sendCmd(activePair.sessionId, "stop")}
                  variant="destructive"
                  className="gap-2 text-base font-semibold"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <Button
                  onClick={() => sendCmd(activePair.sessionId, "stop")}
                  variant="destructive"
                  className="gap-2 text-base font-semibold"
                >
                  <CirclePower className="w-5 h-5" />
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
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Journey Info */}
          {/* <div className="flex gap-6 p-6 bg-gradient-to-r from-slate-800/40 to-slate-800/20 rounded-2xl border border-slate-700">
            <div className="w-64 h-40 bg-slate-800 rounded-xl overflow-hidden flex-shrink-0">
              {thumb ? (
                <img src={thumb} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PlayCircle className="w-16 h-16 text-slate-700" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">{title}</h3>
                {desc && <p className="text-slate-400 text-sm">{desc}</p>}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {duration && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">{duration}s</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <Headset className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white font-medium">{activePair.vrId}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Armchair className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-white font-medium">{activePair.chairId}</span>
                </div>
              </div>
            </div>
          </div>

          
          {journeyCards.length > 1 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {journeyCards.map(({ jid, item }) => {
                const t = item.video?.thumbnail_url;
                const ttl = item.journey?.title || item.video?.title || `Journey ${jid}`;
                const d = item.video?.duration_ms ? Math.round((item.video.duration_ms || 0) / 1000) : null;
                return (
                  <div key={jid} className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800/30">
                    <div className="relative h-28 bg-slate-900">
                      {t ? (
                        <img src={t} alt={ttl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PlayCircle className="w-10 h-10 text-slate-700" />
                        </div>
                      )}
                      {d !== null && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/70 text-white text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {d}s
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-cyan-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {jid}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="text-sm text-white font-medium line-clamp-1">{ttl}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )} */}

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

          {/* Control Panels */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Playback Controls */}
            <Card className="bg-slate-800/30 border-slate-700">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="text-white text-lg">Playback Controls</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => sendCmd(activePair.sessionId, "play")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-14 text-base font-semibold"
                  >
                    <PlayCircle className="w-5 h-5" />
                    Play
                  </Button>
                  <Button
                    onClick={() => sendCmd(activePair.sessionId, "pause")}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2 h-14 text-base font-semibold"
                  >
                    <PauseCircle className="w-5 h-5" />
                    Pause
                  </Button>
                </div>
                <Button
                  onClick={() => sendCmd(activePair.sessionId, "stop")}
                  variant="destructive"
                  className="w-full gap-2 h-14 text-base font-semibold"
                >
                  <StopCircle className="w-5 h-5" />
                  Stop Session
                </Button>
              </CardContent>
            </Card>

            {/* Seek Control */}
            <Card className="bg-slate-800/30 border-slate-700">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="text-white text-lg">Seek Position</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <label className="text-sm text-slate-400 font-medium mb-2 block">Position (milliseconds)</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Enter position in ms"
                    value={Number.isFinite(seekValues[activePair.sessionId]) ? seekValues[activePair.sessionId] : ""}
                    onChange={(ev) => {
                      const val = Number(ev.target.value || 0);
                      setSeekValues((prev) => ({ ...prev, [activePair.sessionId]: val }));
                    }}
                    className="bg-slate-900 border-slate-700 text-white h-14 text-base"
                  />
                </div>
                <Button
                  onClick={() => sendCmd(activePair.sessionId, "seek", seekValues[activePair.sessionId] || 0)}
                  className="w-full gap-2 h-14 bg-cyan-600 hover:bg-cyan-700 text-white text-base font-semibold"
                >
                  <SkipForward className="w-5 h-5" />
                  Seek to Position
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
