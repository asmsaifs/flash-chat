import { cn, formatNumber } from '@/lib/utils'
import type { ReactNode } from 'react'

interface StatsCardProps {
  title: string
  value: number
  delta?: string
  icon?: ReactNode
  className?: string
}

export function StatsCard({ title, value, delta, icon, className }: StatsCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-5 space-y-3', className)}>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">{title}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div>
        <p className="text-3xl font-bold text-foreground">{formatNumber(value)}</p>
        {delta && <p className="text-xs text-muted-foreground mt-1">{delta}</p>}
      </div>
    </div>
  )
}
