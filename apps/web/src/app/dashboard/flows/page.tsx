'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, GitBranch, Power, PowerOff } from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import type { Flow } from '@flashchat/shared'

export default function FlowsPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()
  const router = useRouter()

  const { data } = useQuery({
    queryKey: ['flows', workspaceId],
    queryFn: () => api.get<{ data: Flow[] }>(`/workspaces/${workspaceId}/flows`, workspaceId),
    enabled: !!workspaceId,
  })

  const createFlow = useMutation({
    mutationFn: () => api.post<{ data: Flow }>(`/workspaces/${workspaceId}/flows`, { name: 'Untitled Flow' }, workspaceId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['flows', workspaceId] })
      router.push(`/dashboard/flows/${res.data.id}`)
    },
    onError: (err: Error) => alert(`Failed to create flow: ${err.message}`),
  })

  const togglePublish = useMutation({
    mutationFn: ({ flowId, publish }: { flowId: string; publish: boolean }) =>
      api.post(`/workspaces/${workspaceId}/flows/${flowId}/publish`, { publish }, workspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows', workspaceId] }),
  })

  const flows = data?.data ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flows</h1>
          <p className="text-muted-foreground">Build automated conversation flows</p>
        </div>
        <button
          onClick={() => createFlow.mutate()}
          disabled={createFlow.isPending}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New Flow
        </button>
      </div>

      {flows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No flows yet</p>
          <p className="text-sm">Create your first automated flow</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => (
            <div key={flow.id} className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold truncate">{flow.name}</h3>
                  {flow.description && <p className="text-sm text-muted-foreground">{flow.description}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${flow.isPublished ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {flow.isPublished ? 'Live' : 'Draft'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Updated {formatRelative(flow.updatedAt)}</p>
              <div className="flex gap-2">
                <Link
                  href={`/dashboard/flows/${flow.id}`}
                  className="flex-1 text-center text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-md hover:bg-primary/20 transition-colors"
                >
                  Edit
                </Link>
                <button
                  onClick={() => togglePublish.mutate({ flowId: flow.id, publish: !flow.isPublished })}
                  className="flex items-center gap-1 text-sm border px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
                >
                  {flow.isPublished ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                  {flow.isPublished ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
