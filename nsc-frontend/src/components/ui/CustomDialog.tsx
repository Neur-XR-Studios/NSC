import React from 'react'

export interface CustomDialogProps {
    open: boolean
    onClose: () => void
    title?: React.ReactNode
    headerRight?: React.ReactNode
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | '8xl'
    children: React.ReactNode
    contentClassName?: string
    containerClassName?: string
}

const maxWClass: Record<NonNullable<CustomDialogProps['maxWidth']>, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    '8xl': 'max-w-8xl',
}

export const CustomDialog: React.FC<CustomDialogProps> = ({
    open,
    onClose,
    title,
    headerRight,
    maxWidth = '6xl',
    children,
    contentClassName,
    containerClassName,
}) => {
    React.useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className={`absolute inset-0 flex items-center justify-center p-4 ${containerClassName ?? ''}`}>
                <div className={`w-full ${maxWClass[maxWidth]} bg-[hsl(var(--background))] border border-border shadow-2xl rounded-xl overflow-hidden`}>
                    {(title || headerRight) && (
                        <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-zinc-900/30">
                            <div className="min-w-0">
                                {typeof title === 'string' ? (
                                    <div className="font-semibold text-lg truncate">{title}</div>
                                ) : (
                                    title
                                )}
                            </div>
                            {headerRight}
                        </div>
                    )}
                    <div className={`p-5 max-h-[90vh] overflow-y-auto ${contentClassName ?? ''}`}>{children}</div>
                </div>
            </div>
        </div>
    )
}
