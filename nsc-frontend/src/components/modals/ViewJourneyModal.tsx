import React from 'react'
import type { JourneyItem } from '@/types/journey'
import { VideoPlayer } from '@/components/media/VideoPlayer'
import { AudioPlayer } from '@/components/media/AudioPlayer'
import { JsonViewer } from '@/components/code/JsonViewer'
import { X } from 'lucide-react'
import { CustomDialog } from '@/components/ui/CustomDialog'
import { customCss } from '@/lib/customCss'

interface ViewJourneyModalProps {
  open: boolean
  onClose: () => void
  item: JourneyItem | null
}

export const ViewJourneyModal: React.FC<ViewJourneyModalProps> = ({ open, onClose, item }) => {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !item) return null
  const title = item.journey?.title || item.video?.title

  return (
    <CustomDialog
      open={open}
      onClose={onClose}
      title={<div className="font-semibold text-lg truncate">{title}</div>}
      headerRight={
        <button type="button" onClick={onClose} className={`${customCss.buttonOutline} !h-8 !w-8 inline-flex items-center justify-center`}>
          <X />
        </button>
      }
      maxWidth="8xl"
      contentClassName="grid gap-6 lg:grid-cols-2"
    >
      {/* Left: Video + Audios */}
      <div className="space-y-4">
        {item.video?.url ? (
          <VideoPlayer src={item.video.url} poster={item.video.thumbnail_url} />
        ) : item.video?.thumbnail_url ? (
          <img src={item.video.thumbnail_url} alt={title || ''} className="w-full aspect-video object-cover rounded-md" />
        ) : null}

        {Array.isArray(item.audio_tracks) && item.audio_tracks.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Audio Tracks</div>
            {item.audio_tracks.map((a) => (
              <div key={a.id} className="rounded-md border border-border p-2 bg-zinc-900/30 flex gap-2 items-center">
                <div className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-500">{a.title || a.language_code || 'Track'}</div>
                {a.url && <AudioPlayer src={a.url} className="!w-full" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Details + Telemetry */}
      <div className="space-y-5">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Journey</div>
          <div className="font-medium">{item.journey?.title}</div>
          <div className="text-sm text-muted-foreground">{item.journey?.description || '—'}</div>
        </div>

        {item.telemetry?.url ? (
          <div>
            <div className="text-sm text-muted-foreground mb-2">Telemetry (JSON)</div>
            <JsonViewer url={item.telemetry.url} height={420} />
          </div>
        ) : null}
      </div>
    </CustomDialog>
  )
}
