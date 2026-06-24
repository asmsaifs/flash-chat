import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Webhook } from 'lucide-react'

export function WebhookNode({ data, selected }: NodeProps) {
  const d = data as { url?: string; method?: string }
  return (
    <div className={`rounded-xl border-2 bg-card p-4 min-w-[200px] max-w-[260px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-orange-400'}`}>
      <Handle type="target" position={Position.Top} className="!bg-orange-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-orange-100 flex items-center justify-center">
          <Webhook className="h-4 w-4 text-orange-600" />
        </div>
        <span className="text-sm font-semibold">Webhook</span>
      </div>
      <p className="text-xs text-muted-foreground truncate">{d.url ?? 'Configure URL…'}</p>
      {d.method && (
        <span className="inline-block text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded mt-1">{d.method}</span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-orange-400" />
    </div>
  )
}
