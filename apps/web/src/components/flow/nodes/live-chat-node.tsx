import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Headphones } from 'lucide-react'

export function LiveChatNode({ data, selected }: NodeProps) {
  const d = data as { handoffMessage?: string; notifyAgents?: boolean }
  return (
    <div className={`rounded-xl border-2 bg-card p-4 min-w-[200px] max-w-[260px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-teal-400'}`}>
      <Handle type="target" position={Position.Top} className="!bg-teal-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-teal-100 flex items-center justify-center">
          <Headphones className="h-4 w-4 text-teal-600" />
        </div>
        <span className="text-sm font-semibold">Live Chat</span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{d.handoffMessage ?? 'Configure handoff message…'}</p>
      {d.notifyAgents !== false && (
        <span className="inline-block text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded mt-1">Notifies agents</span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-teal-400" />
    </div>
  )
}
