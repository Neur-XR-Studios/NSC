import React from 'react'
import { CustomDialog } from '@/components/ui/CustomDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { customCss } from '@/lib/customCss'
import api from '@/lib/axios'
import type { ApiEnvelope } from '@/types/pagination'
import { useToast } from '@/hooks/use-toast'
import { JsonViewer } from '@/components/code/JsonViewer'
import { VideoPlayer } from '@/components/media/VideoPlayer'
import { AudioPlayer } from '@/components/media/AudioPlayer'
import { Trash2, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

interface AudioField {
    id: string
    language_code: string
    file: File | null
    previewUrl?: string
}

interface CreateAssetModalProps {
    open: boolean
    onClose: () => void
    onCreated?: () => void
}

export const CreateAssetModal: React.FC<CreateAssetModalProps> = ({ open, onClose, onCreated }) => {
    const { toast } = useToast()
    // Zod schema: require all fields
    const FileSchema = z.custom<File>((v) => v instanceof File, { message: 'File is required' })
    const AudioSchema = z.object({
        language_code: z.string().min(1, 'Language code is required'),
        file: FileSchema,
    })
    const FormSchema = z.object({
        journey_title: z.string().min(1, 'Title is required'),
        journey_description: z.string().min(1, 'Description is required'),
        video: FileSchema,
        telemetry: FileSchema,
        audios: z.array(AudioSchema).min(1, 'At least one audio is required'),
    })
    type FormValues = z.infer<typeof FormSchema>

    const { register, handleSubmit, formState: { errors }, setValue, reset } = useForm<FormValues>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            journey_title: '',
            journey_description: '',
            audios: [],
        } as Partial<FormValues>,
    })
    const [journeyTitle, setJourneyTitle] = React.useState('')
    const [journeyDescription, setJourneyDescription] = React.useState('')
    const [videoFile, setVideoFile] = React.useState<File | null>(null)
    const [telemetryFile, setTelemetryFile] = React.useState<File | null>(null)
    const [videoPreviewUrl, setVideoPreviewUrl] = React.useState<string | null>(null)
    const [telemetryPreviewUrl, setTelemetryPreviewUrl] = React.useState<string | null>(null)
    const [audioFields, setAudioFields] = React.useState<AudioField[]>([
        { id: Math.random().toString(), language_code: 'en', file: null },
    ])
    const [submitting, setSubmitting] = React.useState(false)

    React.useEffect(() => {
        if (!open) return
        // reset form when opened fresh
        setJourneyTitle('')
        setJourneyDescription('')
        setVideoFile(null)
        setTelemetryFile(null)
        reset({ journey_title: '', journey_description: '', audios: [] })
        // revoke any existing URLs
        setVideoPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return null
        })
        setTelemetryPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return null
        })
        setAudioFields((prev) => {
            prev.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
            return [{ id: Math.random().toString(), language_code: 'en', file: null }]
        })
        setSubmitting(false)
    }, [open, reset])

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            setVideoPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return null
            })
            setTelemetryPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return null
            })
        }
    }, [])

    const addAudioField = () =>
        setAudioFields((p) => {
            const next = [...p, { id: Math.random().toString(), language_code: '', file: null }]
            // sync to form (only selected files count)
            const formAudios: FormValues['audios'] = next
                .filter((x) => x.file)
                .map((x) => ({ language_code: x.language_code, file: x.file as File }))
            setValue('audios', formAudios, { shouldValidate: true })
            return next
        })
    const removeAudioField = (id: string) => setAudioFields((p) => {
        const next = p.filter((a) => a.id !== id)
        const formAudios: FormValues['audios'] = next
            .filter((x) => x.file)
            .map((x) => ({ language_code: x.language_code, file: x.file as File }))
        setValue('audios', formAudios, { shouldValidate: true })
        return next
    })
    const updateAudioField = (id: string, patch: Partial<AudioField>) =>
        setAudioFields((p) => {
            const next = p.map((a) => (a.id === id ? { ...a, ...patch } : a))
            const formAudios: FormValues['audios'] = next
                .filter((x) => x.file)
                .map((x) => ({ language_code: x.language_code, file: x.file as File }))
            setValue('audios', formAudios, { shouldValidate: true })
            return next
        })

    const onSubmit = async (values: FormValues) => {
        try {
            setSubmitting(true)

            // 1) Upload video
            const vfd = new FormData()
            vfd.append('title', values.journey_title)
            vfd.append('description', values.journey_description)
            vfd.append('video', videoFile as File)

            const videoRes = await api.post<ApiEnvelope<{ id: number }>>(
                '/videos',
                vfd,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            )
            const video_id = videoRes.data?.id
            if (!video_id) throw new Error('Video upload failed')

            // 2) Upload audios
            const audioTrackIds: number[] = []
            for (const a of audioFields) {
                if (!a.file) continue
                const afd = new FormData()
                afd.append('language_code', a.language_code || 'en')
                afd.append('audio', a.file)
                const aRes = await api.post<ApiEnvelope<{ id: number }>>(
                    '/audio-tracks',
                    afd,
                    { headers: { 'Content-Type': 'multipart/form-data' } }
                )
                const aid = aRes.data?.id
                if (aid) audioTrackIds.push(aid)
            }

            // 3) Upload telemetry
            let telemetry_id: number | null = null
            if (telemetryFile) {
                const tfd = new FormData()
                tfd.append('telemetry', telemetryFile)
                tfd.append('video_id', String(video_id))
                const tRes = await api.post<ApiEnvelope<{ id: number }>>(
                    '/telemetry',
                    tfd,
                    { headers: { 'Content-Type': 'multipart/form-data' } }
                )
                telemetry_id = tRes.data?.id ?? null
            }

            // 4) Create journey
            const jBody = {
                video_id,
                telemetry_id: telemetry_id ?? undefined,
                journey_title: journeyTitle,
                journey_description: journeyDescription,
                audio_track_ids: audioTrackIds,
            }
            await api.post('/journeys', jBody)

            toast({ title: 'Asset created', description: 'Journey and assets have been created successfully.' })
            onClose()
            onCreated?.()
        } catch (err: unknown) {
            console.error(err)
            let msg = 'Failed to create asset'
            if (typeof err === 'object' && err !== null) {
                const e = err as { response?: { data?: { message?: string } }; message?: string }
                msg = e.response?.data?.message || e.message || msg
            }
            toast({ title: 'Error', description: msg, variant: 'destructive' })
        } finally {
            setSubmitting(false)
        }
    }

    if (!open) return null

    return (
        <CustomDialog
            open={open}
            onClose={() => (!submitting ? onClose() : undefined)}
            title={<div className="font-semibold text-lg">Create Asset</div>}
            maxWidth="6xl"
            headerRight={
                <button type="button" onClick={onClose} className={`${customCss.buttonOutline} !h-8 !w-8 inline-flex items-center justify-center`}>
                    <X />
                </button>
            }
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm">Journey Title</label>
                        <Input
                            placeholder="Morning Shift"
                            value={journeyTitle}
                            {...register('journey_title')}
                            onChange={(e) => { setJourneyTitle(e.target.value); }}
                            className={customCss.input}
                        />
                        {errors.journey_title && <div className="text-xs text-red-400">{errors.journey_title.message}</div>}
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm">Journey Description</label>
                        <Input
                            placeholder="Reception lobby"
                            value={journeyDescription}
                            {...register('journey_description')}
                            onChange={(e) => { setJourneyDescription(e.target.value); }}
                            className={customCss.input}
                        />
                        {errors.journey_description && <div className="text-xs text-red-400">{errors.journey_description.message}</div>}
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm">Video File</label>
                        {!videoPreviewUrl ? (
                            <input
                                type="file"
                                accept="video/*"
                                onChange={(e) => {
                                    const f = e.target.files?.[0] || null
                                    setVideoFile(f)
                                    if (f) setValue('video', f)
                                    setVideoPreviewUrl((prev) => {
                                        if (prev) URL.revokeObjectURL(prev)
                                        return f ? URL.createObjectURL(f) : null
                                    })
                                }}
                                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
                            />
                        ) : (
                            <div className="space-y-2 relative">
                                <VideoPlayer src={videoPreviewUrl} className="mt-2" />
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => {
                                        setVideoFile(null)
                                        setValue('video', undefined as unknown as File)
                                        setVideoPreviewUrl((prev) => {
                                            if (prev) URL.revokeObjectURL(prev)
                                            return null
                                        })
                                    }}
                                    className={`${customCss.buttonDestructive} w-4 h-4 p-4 absolute top-1 right-2`}
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        )}
                        {errors.video && <div className="text-xs text-red-400">{errors.video.message as string}</div>}
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm">Telemetry JSON</label>
                        {!telemetryPreviewUrl ? (
                            <input
                                type="file"
                                accept="application/json,.json"
                                onChange={async (e) => {
                                    const f = e.target.files?.[0] || null
                                    setTelemetryFile(f)
                                    if (f) setValue('telemetry', f)
                                    setTelemetryPreviewUrl((prev) => {
                                        if (prev) URL.revokeObjectURL(prev)
                                        return f ? URL.createObjectURL(f) : null
                                    })
                                }}
                                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
                            />
                        ) : (
                            <div className="space-y-2">
                                <JsonViewer url={telemetryPreviewUrl} height={270} title="telemetry.json (preview)" extra={
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={() => {
                                            setTelemetryFile(null)
                                            setValue('telemetry', undefined as unknown as File)
                                            setTelemetryPreviewUrl((prev) => {
                                                if (prev) URL.revokeObjectURL(prev)
                                                return null
                                            })
                                        }}
                                        className={`${customCss.buttonDestructive} w-4 h-4 p-4`}
                                    >
                                        <Trash2 />
                                    </Button>
                                } />
                            </div>
                        )}
                        {errors.telemetry && <div className="text-xs text-red-400">{errors.telemetry.message as string}</div>}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Audio Tracks</div>
                    </div>

                    <div className="space-y-3">
                        {audioFields.map((a) => (
                            <div key={a.id} className="grid md:grid-cols-3 gap-3 items-end border border-border rounded p-3 bg-zinc-900/30 relative">
                                <div className="space-y-1">
                                    <label className="text-xs">Language Code</label>
                                    <Input
                                        placeholder="en"
                                        value={a.language_code}
                                        onChange={(e) => updateAudioField(a.id, { language_code: e.target.value })}
                                        className={customCss.input}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs">Audio File</label>
                                    {!a.previewUrl ? (
                                        <input
                                            type="file"
                                            accept="audio/*"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0] || null
                                                if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
                                                updateAudioField(a.id, { file: f, previewUrl: f ? URL.createObjectURL(f) : undefined })
                                            }}
                                            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <AudioPlayer src={a.previewUrl} className="!w-fit" />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                className={`${customCss.buttonDestructive} w-8 h-8`}
                                                onClick={() => {
                                                    if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
                                                    updateAudioField(a.id, { file: null, previewUrl: undefined })
                                                }}
                                                disabled={submitting}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute top-2 right-2">
                                    {audioFields.length > 1 && <Button
                                        type="button"
                                        variant="destructive"
                                        className={`${submitting || audioFields.length <= 1 ? customCss.buttonDisabled : customCss.buttonDestructive} w-4 h-4 p-2`}
                                        onClick={() => removeAudioField(a.id)}
                                        disabled={submitting || audioFields.length <= 1}
                                    >
                                        <X />
                                    </Button>}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" className={customCss.buttonOutline} onClick={addAudioField} disabled={submitting}>
                        + Add Audio
                    </Button>
                    {errors.audios && <div className="text-xs text-red-400">{errors.audios.message as string}</div>}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" className={customCss.buttonOutline} onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="default" className={customCss.button} disabled={submitting}>
                        {submitting ? 'Creating...' : 'Create Asset'}
                    </Button>
                </div>
            </form>
        </CustomDialog>
    )
}
