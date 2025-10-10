export type JourneyItem = {
  journey: {
    id: number
    title: string
    description: string | null
    createdAt?: string
    updatedAt?: string
  }
  video: {
    id: number
    title: string
    description: string | null
    thumbnail_url?: string
    url?: string
    duration_ms?: number
    mime_type?: string
  }
  audio_track: unknown | null
  audio_tracks?: Array<{
    id: number
    audio_url?: string
    url?: string
    language_code?: string
    title?: string | null
  }>
  telemetry?: {
    id: number
    version?: string
    format?: string
    url?: string
  }
  languages?: string[]
}
