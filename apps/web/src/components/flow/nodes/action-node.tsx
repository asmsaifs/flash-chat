import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Tag } from 'lucide-react'

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as { actionType?: string; tag?: string; field?: string }
  return (
    <div className={`rounded-xl border-2 bg-card p-4 min-w-[180px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-orange-400'}`}>
      <Handle type="target" position={Position.Top} className="!bg-orange-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-orange-100 flex items-center justify-center">
          <Tag className="h-4 w-4 text-orange-600" />
        </div>
        <span className="text-sm font-semibold">Action</span>
      </div>
      <p className="text-xs text-muted-foreground capitalize">{d.actionType?.replace('_', ' ') ?? 'Configure action…'}</p>
      {d.tag && <p className="text-xs font-mono mt-1 bg-muted px-1.5 py-0.5 rounded">#{d.tag}</p>}
      <Handle type="source" position={Position.Bottom} className="!bg-orange-400" />
    </div>
  )
}
