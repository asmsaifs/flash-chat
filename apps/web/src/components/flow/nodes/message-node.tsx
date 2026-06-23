import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MessageSquare } from 'lucide-react'

export function MessageNode({ data, selected }: NodeProps) {
  const d = data as { content?: { type: string; text?: string } }
  return (
    <div className={`rounded-xl border-2 bg-card p-4 min-w-[200px] max-w-[260px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-blue-400'}`}>
      <Handle type="target" position={Position.Top} className="!bg-blue-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-blue-600" />
        </div>
        <span className="text-sm font-semibold">Message</span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{d.content?.text ?? 'Configure message…'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400" />
    </div>
  )
}
