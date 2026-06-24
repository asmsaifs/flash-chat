import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Clock } from 'lucide-react'

export function DelayNode({ data, selected }: NodeProps) {
  const d = data as { delayMs?: number }
  const seconds = d.delayMs ? d.delayMs / 1000 : null
  return (
    <div className={`rounded-xl border-2 bg-card p-4 min-w-[180px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-slate-400'}`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
          <Clock className="h-4 w-4 text-slate-600" />
        </div>
        <span className="text-sm font-semibold">Delay</span>
      </div>
      <p className="text-xs text-muted-foreground">{seconds != null ? `Wait ${seconds}s` : 'Configure delay…'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  )
}
