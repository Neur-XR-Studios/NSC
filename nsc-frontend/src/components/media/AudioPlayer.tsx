import React, { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'

interface AudioPlayerProps {
  src: string
  className?: string
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  const onTimeUpdate = () => {
    const el = audioRef.current
    if (!el) return
    setProgress((el.currentTime / (el.duration || 1)) * 100)
    setCurrent(el.currentTime)
  }
  const onLoadedMetadata = () => {
    const el = audioRef.current
    if (!el) return
    setDuration(el.duration || 0)
  }
  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current
    if (!el) return
    const pct = Number(e.target.value)
    el.currentTime = (pct / 100) * (el.duration || 0)
    setProgress(pct)
    setCurrent(el.currentTime)
  }
  const toggleMute = () => {
    const el = audioRef.current
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
    setVolume(el.muted ? 0 : 1)
  }
  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current
    if (!el) return
    const v = Number(e.target.value)
    el.volume = v
    setVolume(v)
    if (v > 0 && el.muted) {
      el.muted = false
      setMuted(false)
    }
  }

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
  }, [])

  const fmt = (n: number) => {
    const s = Math.floor(n % 60)
    const m = Math.floor((n / 60) % 60)
    const h = Math.floor(n / 3600)
    const pad = (x: number) => x.toString().padStart(2, '0')
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
  }

  return (
    <div className={`min-w-fit ${className}`}>
      <audio ref={audioRef} src={src} onTimeUpdate={onTimeUpdate} onLoadedMetadata={onLoadedMetadata} />
      <div className="flex items-center gap-3 p-2 rounded-md bg-gradient-to-t from-black/70 to-black/10 backdrop-blur-sm border border-white/10">
        <button
          type="button"
          className="h-8 w-8 inline-flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white"
          onClick={togglePlay}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <input aria-label="Seek" type="range" min={0} max={100} value={progress} onChange={onSeek} className="flex-1 accent-cyan-500" />
        <div className="text-[11px] text-white/80 w-24 text-right">
          {fmt(current)} / {fmt(duration)}
        </div>
        <button
          type="button"
          className="h-8 w-8 inline-flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white"
          onClick={toggleMute}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input aria-label="Volume" type="range" min={0} max={1} step={0.05} value={volume} onChange={onVolume} className="w-24 accent-cyan-500" />
      </div>
    </div>
  )
}
