import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MessageSquare } from 'lucide-react'

type Content = { type: string; text?: string; replies?: unknown[]; buttons?: unknown[]; url?: string }

export function MessageNode({ data, selected }: NodeProps) {
  const d = data as { content?: Content }
  const c = d.content
  const preview = c?.type === 'quick_replies'
    ? `${c.replies?.length ?? 0} quick repl${(c.replies?.length ?? 0) === 1 ? 'y' : 'ies'}`
    : c?.type === 'buttons'
    ? `${c.buttons?.length ?? 0} button${(c.buttons?.length ?? 0) === 1 ? '' : 's'}`
    : c?.type === 'image'
    ? 'Image'
    : (c?.text ?? 'Configure message…')

  return (
    <div className={`rounded-xl border-2 bg-card p-4 min-w-[200px] max-w-[260px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-blue-400'}`}>
      <Handle type="target" position={Position.Top} className="!bg-blue-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-blue-600" />
        </div>
        <span className="text-sm font-semibold">Message</span>
        {c?.type && c.type !== 'text' && (
          <span className="ml-auto text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded capitalize">
            {c.type.replace('_', ' ')}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{preview}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400" />
    </div>
  )
}
