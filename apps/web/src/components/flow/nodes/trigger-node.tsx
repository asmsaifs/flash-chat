import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Zap } from 'lucide-react'

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as { triggerType?: string; keyword?: string }
  return (
    <div className={`rounded-xl border-2 bg-card p-4 min-w-[180px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-green-400'}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-green-100 flex items-center justify-center">
          <Zap className="h-4 w-4 text-green-600" />
        </div>
        <span className="text-sm font-semibold">Trigger</span>
      </div>
      <p className="text-xs text-muted-foreground capitalize">{d.triggerType ?? 'keyword'}</p>
      {d.keyword && <p className="text-xs font-mono mt-1 bg-muted px-1.5 py-0.5 rounded">"{d.keyword}"</p>}
      <Handle type="source" position={Position.Bottom} className="!bg-green-400" />
    </div>
  )
}
