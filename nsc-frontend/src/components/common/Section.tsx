import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface SectionProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function Section({ title, subtitle, actions, className, children }: SectionProps) {
  return (
    <Card className={cn('p-4 md:p-5 border-border/70 bg-card', className)}>
      {(title || subtitle || actions) && (
        <div className="mb-3 flex items-center gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base md:text-lg font-semibold leading-none truncate">{title}</h2>}
            {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate">{subtitle}</p>}
          </div>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </div>
      )}
      {children}
    </Card>
  )
}

export default Section
