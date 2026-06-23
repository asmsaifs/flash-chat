import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as { field?: string; operator?: string; value?: unknown }
  return (
    <div className={`rounded-xl border-2 bg-card p-4 min-w-[200px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-yellow-400'}`}>
      <Handle type="target" position={Position.Top} className="!bg-yellow-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-lg bg-yellow-100 flex items-center justify-center">
          <GitBranch className="h-4 w-4 text-yellow-600" />
        </div>
        <span className="text-sm font-semibold">Condition</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {d.field ?? 'field'} {d.operator ?? '='} {String(d.value ?? '...')}
      </p>
      <div className="flex justify-between mt-3">
        <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} className="!bg-green-400" />
        <span className="text-xs text-green-600 absolute bottom-2 left-[22%]">Yes</span>
        <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} className="!bg-red-400" />
        <span className="text-xs text-red-500 absolute bottom-2 left-[62%]">No</span>
      </div>
    </div>
  )
}
