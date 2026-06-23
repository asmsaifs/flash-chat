import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Brain } from 'lucide-react'

export function AiReplyNode({ data, selected }: NodeProps) {
  const d = data as { fallbackToHuman?: boolean }
  return (
    <div className={`rounded-xl border-2 bg-card p-4 min-w-[180px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-purple-400'}`}>
      <Handle type="target" position={Position.Top} className="!bg-purple-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
          <Brain className="h-4 w-4 text-purple-600" />
        </div>
        <span className="text-sm font-semibold">AI Reply</span>
      </div>
      <p className="text-xs text-muted-foreground">Answers from knowledge base</p>
      {d.fallbackToHuman && (
        <span className="inline-block text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded mt-1">→ Human fallback</span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400" />
    </div>
  )
}
