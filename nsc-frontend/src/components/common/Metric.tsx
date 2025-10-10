import { Card } from '@/components/ui/card'
import type { ReactNode } from 'react'

interface MetricProps {
  label: string
  value: ReactNode
  trend?: ReactNode
}

export function Metric({ label, value, trend }: MetricProps) {
  return (
    <Card className="p-4 bg-card border-border/70">
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {trend && <div className="text-xs text-muted-foreground mt-1">{trend}</div>}
    </Card>
  )
}

export default Metric
