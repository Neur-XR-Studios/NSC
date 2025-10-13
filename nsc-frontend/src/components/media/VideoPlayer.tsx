import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  isMuted?: boolean;
  isAutoPlay?: boolean;
  isShowVolume?: boolean;
  isShowFullscreen?: boolean;
  ontogglePlay?: (playing: boolean) => void;
  onTimeUpdateRes?: (progress: number) => void;
  onTimeUpdateMs?: (ms: number) => void;
  onDurationMs?: (ms: number) => void;
  externalCurrentMs?: number;
  externalPlaying?: boolean;
}

export type VideoPlayerHandle = {
  play: () => void;
  pause: () => void;
  seekTo: (ms: number) => void;
  getCurrentTimeMs: () => number;
};

const VideoPlayerInner: React.ForwardRefRenderFunction<VideoPlayerHandle, VideoPlayerProps> = ({
  src,
  poster,
  className,
  isMuted = false,
  isAutoPlay = false,
  isShowVolume = true,
  isShowFullscreen = true,
  ontogglePlay,
  onTimeUpdateRes,
  onTimeUpdateMs,
  onDurationMs,
  externalCurrentMs,
  externalPlaying,
}, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(isAutoPlay);
  const [muted, setMuted] = useState(isMuted);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useImperativeHandle(ref, () => ({
    play: () => {
      const el = videoRef.current;
      if (!el) return;
      el.play().catch(() => {});
    },
    pause: () => {
      const el = videoRef.current;
      if (!el) return;
      el.pause();
    },
    seekTo: (ms: number) => {
      const el = videoRef.current;
      if (!el) return;
      el.currentTime = Math.max(0, (ms || 0) / 1000);
    },
    getCurrentTimeMs: () => {
      const el = videoRef.current;
      return el ? (el.currentTime || 0) * 1000 : 0;
    },
  }), []);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPlaying(true);
      ontogglePlay?.(true);
    } else {
      el.pause();
      setPlaying(false);
      ontogglePlay?.(false);
    }
  };

  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setProgress((el.currentTime / (el.duration || 1)) * 100);
    onTimeUpdateRes?.((el.currentTime / (el.duration || 1)) * 100);
    onTimeUpdateMs?.((el.currentTime || 0) * 1000);
  };

  const onLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    setDuration(el.duration || 0);
    onDurationMs?.(((el.duration || 0) * 1000));
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const pct = Number(e.target.value);
    el.currentTime = (pct / 100) * (el.duration || 0);
    setProgress(pct);
    onTimeUpdateRes?.((el.currentTime / (el.duration || 1)) * 100);
    onTimeUpdateMs?.((el.currentTime || 0) * 1000);
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
    setVolume(el.muted ? 0 : 1);
  };

  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const v = Number(e.target.value);
    el.volume = v;
    setVolume(v);
    if (v > 0 && el.muted) {
      el.muted = false;
      setMuted(false);
    }
  };

  const fullscreen = async () => {
    const target = containerRef.current;
    if (!target) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, []);

  // Sync external current time (ms)
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (typeof externalCurrentMs === "number" && isFinite(externalCurrentMs) && externalCurrentMs >= 0) {
      const targetSec = (externalCurrentMs / 1000) || 0;
      // Avoid thrashing: only seek if difference > 300ms
      if (Math.abs((el.currentTime || 0) - targetSec) > 0.3) {
        el.currentTime = targetSec;
      }
    }
  }, [externalCurrentMs]);

  // Sync external playing state
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (typeof externalPlaying === "boolean") {
      if (externalPlaying && el.paused) {
        el.play().catch(() => {/* ignore */});
      } else if (!externalPlaying && !el.paused) {
        el.pause();
      }
    }
  }, [externalPlaying]);

  const fmt = useMemo(
    () => (n: number) => {
      const s = Math.floor(n % 60);
      const m = Math.floor((n / 60) % 60);
      const h = Math.floor(n / 3600);
      const pad = (x: number) => x.toString().padStart(2, "0");
      return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    },
    [],
  );

  return (
    <div className={className} ref={containerRef}>
      <div className="relative w-full aspect-video bg-black overflow-hidden rounded-md">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="absolute inset-0 h-full w-full object-contain"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          controls={false}
        />
        {/* Controls overlay */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end">
          <div className="pointer-events-auto m-2 rounded-md bg-gradient-to-t from-black/70 to-black/10 p-2 backdrop-blur-sm border border-white/10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="h-8 w-12 inline-flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white"
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <input
                aria-label="Seek"
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={onSeek}
                className="flex-1 accent-cyan-500"
              />
              <div className="text-[11px] text-white/80 w-24 text-right">
                {fmt((progress / 100) * (duration || 0))} / {fmt(duration)}
              </div>
              {isShowVolume && (
                <>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="h-8 w-12 inline-flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white"
                  >
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    aria-label="Volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={onVolume}
                    className="w-24 accent-cyan-500"
                  />
                </>
              )}
              {isShowFullscreen && (
                <button
                  type="button"
                  onClick={fullscreen}
                  className="h-8 w-12 inline-flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white"
                >
                  <Maximize size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(VideoPlayerInner);
