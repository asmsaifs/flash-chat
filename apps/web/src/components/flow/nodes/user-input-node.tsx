import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MessageCircleQuestion } from 'lucide-react'

export function UserInputNode({ data, selected }: NodeProps) {
  const d = data as { prompt?: { text?: string } | string; captureField?: string }
  const promptText = typeof d.prompt === 'string' ? d.prompt : d.prompt?.text
  return (
    <div className={`rounded-xl border-2 bg-card p-4 min-w-[200px] max-w-[260px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-yellow-400'}`}>
      <Handle type="target" position={Position.Top} className="!bg-yellow-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-yellow-100 flex items-center justify-center">
          <MessageCircleQuestion className="h-4 w-4 text-yellow-600" />
        </div>
        <span className="text-sm font-semibold">User Input</span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{promptText ?? 'Configure prompt…'}</p>
      {d.captureField && (
        <span className="inline-block text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded mt-1">→ {d.captureField}</span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400" />
    </div>
  )
}
