import React from 'react'
import { CustomDialog } from '@/components/ui/CustomDialog'
import { Button } from '@/components/ui/button'
import api from '@/lib/axios'
import { useToast } from '@/hooks/use-toast'
import { Clock, CheckCircle2, XCircle, X } from 'lucide-react'
import { customCss } from '@/lib/customCss'

type PairType = 'vr' | 'chair'

interface CreatePairingCodeModalProps {
    open: boolean
    onClose: () => void
}

export const CreatePairingCodeModal: React.FC<CreatePairingCodeModalProps> = ({ open, onClose }) => {
    const { toast } = useToast()
    const [type, setType] = React.useState<PairType>('vr')
    const [loading, setLoading] = React.useState(false)
    const [code, setCode] = React.useState<string | null>(null)
    const [expiresAt, setExpiresAt] = React.useState<string | null>(null)
    const [expired, setExpired] = React.useState(false)
    const [now, setNow] = React.useState<number>(Date.now())

    React.useEffect(() => {
        if (!open) return
        setType('vr')
        setLoading(false)
        setCode(null)
        setExpiresAt(null)
        setExpired(false)
        setNow(Date.now())
    }, [open])

    React.useEffect(() => {
        if (!open) return
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [open])

    const remainingMs = React.useMemo(() => {
        if (!expiresAt) return 0
        const end = new Date(expiresAt).getTime()
        return Math.max(0, end - now)
    }, [expiresAt, now])

    React.useEffect(() => {
        if (expiresAt && remainingMs === 0 && code) {
            setExpired(true)
        }
    }, [expiresAt, remainingMs, code])

    const mmss = (ms: number) => {
        const total = Math.floor(ms / 1000)
        const m = Math.floor(total / 60)
        const s = total % 60
        const pad = (n: number) => n.toString().padStart(2, '0')
        return `${pad(m)}:${pad(s)}`
    }

    type PairingCodeResponse = {
        code?: string
        expiresAt?: string
    }

    async function generate() {
        setLoading(true)
        try {
            const res = await api.post('/devices/pairing-code', { type }) as unknown as { data?: PairingCodeResponse }
            const data = res?.data || {}
            setCode(data.code ?? null)
            setExpiresAt(data.expiresAt ?? null)
            setExpired(false)
            if (!data.code || !data.expiresAt) {
                toast({ title: 'Invalid response', description: 'Missing code or expiresAt', variant: 'destructive' })
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } }; message?: string }
            toast({
                title: 'Error',
                description: e.response?.data?.message || e.message || 'Failed to generate code',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const getProgressPercentage = () => {
        if (!expiresAt || expired) return 0
        const start = new Date(expiresAt).getTime() - (5 * 60 * 1000) // Assuming 5 min validity
        const end = new Date(expiresAt).getTime()
        const total = end - start
        const remaining = end - now
        return Math.max(0, Math.min(100, (remaining / total) * 100))
    }

    if (!open) return null

    return (
        <CustomDialog
            open={open}
            onClose={() => (!loading ? onClose() : undefined)}
            title={
                <div>
                    <div className="font-semibold text-lg">Device Pairing</div>
                    <div className="text-xs text-muted-foreground font-normal">Generate a secure pairing code</div>
                </div>
            }
            headerRight={
                <button type="button" onClick={onClose} className={`${customCss.buttonOutline} !h-8 !w-8 inline-flex items-center justify-center`}>
                    <X />
                </button>
            }
        >
            <div className="space-y-6 py-2">
                {/* Type Selection */}
                {!code && (
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Select Device Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setType('vr')}
                                disabled={loading}
                                className={`p-4 rounded-xl border-2 transition-all duration-200 ${type === 'vr'
                                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 shadow-lg shadow-cyan-500/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <div className="flex flex-col items-center gap-2">
                                    {/* <Smartphone className={`w-8 h-8 ${type === 'vr' ? 'text-cyan-500' : 'text-gray-400'}`} /> */}
                                    <svg fill="#000000" width="800px" height="800px" viewBox="0 0 24 24" id="vr-glasses" data-name="Flat Color" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${type === 'vr' ? 'text-cyan-500' : 'text-gray-400'}`}>
                                        <g id="SVGRepo_bgCarrier" strokeWidth="0" />
                                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" stroke-linejoin="round" />
                                        <g id="SVGRepo_iconCarrier">
                                            <path id="secondary" d="M22,12.5v3a1,1,0,0,1-.76,1l-2,.5A1,1,0,0,1,19,17a1,1,0,0,1-1-1V12a1,1,0,0,1,.38-.79,1,1,0,0,1,.86-.18l2,.5A1,1,0,0,1,22,12.5ZM4.76,11l-2,.5a1,1,0,0,0-.76,1v3a1,1,0,0,0,.76,1l2,.5A1,1,0,0,0,5,17a1,1,0,0,0,1-1V12a1,1,0,0,0-1.24-1Zm13-.41A1,1,0,0,1,17,11H7a1,1,0,0,1-.79-.38A1,1,0,0,1,6,9.76l.24-1A5,5,0,0,1,11.12,5h1.76a5,5,0,0,1,4.85,3.79l.24,1A1,1,0,0,1,17.79,10.62ZM15.71,9a3,3,0,0,0-2.83-2H11.12A3,3,0,0,0,8.29,9Z" style={{ fill: '#2ca9bc' }} />
                                            <path id="primary" d="M18,9H6a2,2,0,0,0-2,2v6a2,2,0,0,0,2,2H7.75a3.5,3.5,0,0,0,2.8-1.4,1.49,1.49,0,0,1,1.2-.6h.5a1.49,1.49,0,0,1,1.2.6,3.5,3.5,0,0,0,2.8,1.4H18a2,2,0,0,0,2-2V11A2,2,0,0,0,18,9Z" style={{ fill: '#fff' }} />
                                        </g>
                                    </svg>
                                    <span className={`font-medium text-sm ${type === 'vr' ? 'text-cyan-700 dark:text-cyan-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                        VR Headset
                                    </span>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('chair')}
                                disabled={loading}
                                className={`p-4 rounded-xl border-2 transition-all duration-200 ${type === 'chair'
                                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 shadow-lg shadow-cyan-500/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <svg viewBox="0 0 1024 1024" className={`w-8 h-8 ${type === 'chair' ? 'text-cyan-500' : 'text-gray-400'}`} version="1.1" xmlns="http://www.w3.org/2000/svg" fill="#747474" stroke="#747474">
                                        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" stroke-linejoin="round"></g>
                                        <g id="SVGRepo_iconCarrier">
                                            <path
                                                d="M544 767.968h-64v46.272l-194.272 121.376c19.68 10.4 33.28 30.592 34.048 54.176L480 889.696v47.168c9.44-5.504 20.288-8.864 32-8.864s22.56 3.36 32 8.864v-47.168l160.224 100.128a63.68 63.68 0 0 1 34.016-54.176L544 814.24v-46.272zM192 543.968h32v64H192zM800 543.968h32v64h-32z"
                                                fill="#DAE2E5"></path>
                                            <path d="M768 991.968m-32 0a32 32 0 1 0 64 0 32 32 0 1 0-64 0Z" fill="#fff"></path>
                                            <path d="M512 991.968m-32 0a32 32 0 1 0 64 0 32 32 0 1 0-64 0Z" fill="#fff"></path>
                                            <path d="M256 991.968m-32 0a32 32 0 1 0 64 0 32 32 0 1 0-64 0Z" fill="#fff"></path>
                                            <path d="M736 607.968v-544a64 64 0 0 0-64-64H352a64 64 0 0 0-64 64v544h448z" fill="#2ca9bc"></path>
                                            <path d="M480 767.968h64v32h-64z" fill=""></path>
                                            <path
                                                d="M864 543.968v-224a32 32 0 0 0-32-32h-32a32 32 0 0 0-32 32v224h96zM256 543.968v-224a32 32 0 0 0-32-32H192a32 32 0 0 0-32 32v224h96z"
                                                fill="#fff"></path>
                                            <path d="M192 543.968h32v32H192zM800 543.968h32v32h-32z" fill=""></path>
                                            <path d="M288 575.968h448v32H288z" fill=""></path>
                                            <path
                                                d="M832 607.968H192a32 32 0 0 0-32 32 128 128 0 0 0 128 128h448a128 128 0 0 0 128-128 32 32 0 0 0-32-32z"
                                                fill="#fff"></path>
                                            <path d="M608 127.968m-32 0a32 32 0 1 0 64 0 32 32 0 1 0-64 0Z" fill=""></path>
                                            <path d="M512 255.968m-32 0a32 32 0 1 0 64 0 32 32 0 1 0-64 0Z" fill=""></path>
                                            <path d="M416 127.968m-32 0a32 32 0 1 0 64 0 32 32 0 1 0-64 0Z" fill=""></path>
                                            <path d="M608 383.968m-32 0a32 32 0 1 0 64 0 32 32 0 1 0-64 0Z" fill=""></path>
                                            <path d="M416 383.968m-32 0a32 32 0 1 0 64 0 32 32 0 1 0-64 0Z" fill=""></path>
                                        </g>
                                    </svg>
                                    <span className={`font-medium text-sm ${type === 'chair' ? 'text-cyan-700 dark:text-cyan-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                        Smart Chair
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* Generate Button */}
                {!code && (
                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={() => void generate()}
                            disabled={loading}
                            className={customCss.button}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Generating...
                                </div>
                            ) : (
                                'Generate Code'
                            )}
                        </Button>
                    </div>
                )}

                {/* Code Display */}
                {code && (
                    <div className="space-y-4">
                        {/* Status Badge */}
                        <div className="flex items-center justify-center">
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${expired
                                ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                                : 'bg-cyan-100 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400'
                                }`}>
                                {expired ? (
                                    <>
                                        <XCircle className="w-4 h-4" />
                                        Code Expired
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Active Code
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Code Display */}
                        <div className={`relative p-8 rounded-2xl border-2 ${expired
                            ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20'
                            : 'border-cyan-200 dark:border-cyan-900 bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/20 dark:to-teal-950/20'
                            }`}>
                            {!expired && (
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-t-2xl overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-cyan-500 to-teal-600 transition-all duration-1000 ease-linear"
                                        style={{ width: `${getProgressPercentage()}%` }}
                                    />
                                </div>
                            )}

                            <div className="text-center space-y-3">
                                <div className={`text-sm font-medium ${expired ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {expired ? 'This code has expired' : 'Enter this code on your device'}
                                </div>
                                <div className={`text-5xl font-bold tracking-[0.5em] font-mono ${expired
                                    ? 'text-red-400 dark:text-red-500 line-through opacity-50'
                                    : 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-teal-600 dark:from-cyan-400 dark:to-teal-400'
                                    }`}>
                                    {code}
                                </div>
                            </div>
                        </div>

                        {/* Timer */}
                        <div className={`flex items-center justify-center gap-3 p-4 rounded-xl ${expired
                            ? 'bg-red-50 dark:bg-red-950/20'
                            : 'bg-cyan-50 dark:bg-cyan-950/20'
                            }`}>
                            <Clock className={`w-5 h-5 ${expired ? 'text-red-500' : 'text-cyan-500'}`} />
                            <span className={`text-lg font-semibold font-mono ${expired
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-cyan-700 dark:text-cyan-400'
                                }`}>
                                {expired ? '00:00' : mmss(remainingMs)}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {expired ? 'remaining' : 'remaining'}
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setCode(null)
                                    setExpiresAt(null)
                                    setExpired(false)
                                }}
                                disabled={loading}
                                className={customCss.buttonDestructive}
                            >
                                Clear
                            </Button>
                            <Button
                                type="button"
                                onClick={() => void generate()}
                                disabled={loading}
                                className={customCss.button}
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Generating...
                                    </div>
                                ) : (
                                    'Generate New Code'
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </CustomDialog>
    )
}