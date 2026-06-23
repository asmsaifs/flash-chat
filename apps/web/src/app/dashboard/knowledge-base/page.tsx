'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { Brain, Plus, Trash2, Link } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { KnowledgeBaseItem } from '@flashchat/shared'

export default function KnowledgeBasePage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'manual' | 'url'>('manual')
  const [form, setForm] = useState({ title: '', content: '' })
  const [url, setUrl] = useState('')

  const { data } = useQuery({
    queryKey: ['knowledge-base', workspaceId],
    queryFn: () => api.get<{ data: KnowledgeBaseItem[] }>(`/workspaces/${workspaceId}/knowledge-base`, workspaceId),
    enabled: !!workspaceId,
  })

  const addItem = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/knowledge-base`, { ...form, sourceType: 'manual' }, workspaceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-base', workspaceId] }); setForm({ title: '', content: '' }) },
  })

  const ingestUrl = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/knowledge-base/ingest-url`, { url }, workspaceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-base', workspaceId] }); setUrl('') },
  })

  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/knowledge-base/${id}`, workspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-base', workspaceId] }),
  })

  const items = data?.data ?? []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Knowledge Base</h1>
        <p className="text-muted-foreground">Train your AI on your content</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setTab('manual')} className={`text-sm px-3 py-1.5 rounded-md ${tab === 'manual' ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'}`}>
              Manual Entry
            </button>
            <button onClick={() => setTab('url')} className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-md ${tab === 'url' ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent'}`}>
              <Link className="h-3 w-3" /> Import URL
            </button>
          </div>

          {tab === 'manual' ? (
            <>
              <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Title (e.g. Refund Policy)" className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
              <textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Paste your content here…" rows={6} className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none" />
              <button onClick={() => addItem.mutate()} disabled={addItem.isPending || !form.title || !form.content}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                <Plus className="h-4 w-4" /> {addItem.isPending ? 'Adding…' : 'Add to Knowledge Base'}
              </button>
            </>
          ) : (
            <>
              <input value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-site.com/faq" className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
              <button onClick={() => ingestUrl.mutate()} disabled={ingestUrl.isPending || !url}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                <Link className="h-4 w-4" /> {ingestUrl.isPending ? 'Importing…' : 'Import URL'}
              </button>
            </>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">{items.length} items in knowledge base</h3>
          {items.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No content yet. Add your first item.</p>
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border bg-card p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm">{item.title}</p>
                <button onClick={() => deleteItem.mutate(item.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
              <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)} · {item.sourceType}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
