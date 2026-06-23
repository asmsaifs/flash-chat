'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { AI_MODELS } from '@flashchat/shared'
import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.get<{ data: { name: string; aiModel: string; slug: string } }>(`/workspaces/${workspaceId}`, workspaceId),
    enabled: !!workspaceId,
  })

  const ws = data?.data
  const [name, setName] = useState('')
  const [aiModel, setAiModel] = useState('')

  useEffect(() => {
    if (ws) { setName(ws.name); setAiModel(ws.aiModel) }
  }, [ws])

  const save = useMutation({
    mutationFn: () => api.patch(`/workspaces/${workspaceId}`, { name, aiModel }, workspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace', workspaceId] }),
  })

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage workspace configuration</p>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">General</h2>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Workspace Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">AI Configuration</h2>
        <p className="text-sm text-muted-foreground">Choose the AI model used for auto-replies and flow suggestions.</p>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Model</label>
          <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background">
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
          {save.isPending ? 'Saving…' : 'Save AI Settings'}
        </button>
      </div>
    </div>
  )
}
