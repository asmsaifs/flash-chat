'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { Megaphone, Plus, Send } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Broadcast } from '@flashchat/shared'

export default function BroadcastsPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', text: '', audienceType: 'all', audienceValue: '' })

  const { data: broadcastsData } = useQuery({
    queryKey: ['broadcasts', workspaceId],
    queryFn: () => api.get<{ data: Broadcast[] }>(`/workspaces/${workspaceId}/broadcasts`, workspaceId),
    enabled: !!workspaceId,
  })

  const { data: channelsData } = useQuery({
    queryKey: ['channels', workspaceId],
    queryFn: () => api.get<{ data: Array<{ id: string; name: string }> }>(`/workspaces/${workspaceId}/channels`, workspaceId),
    enabled: !!workspaceId,
  })

  const channels = channelsData?.data ?? []
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])

  const create = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/broadcasts`, {
      name: form.name,
      channelIds: selectedChannels.length > 0 ? selectedChannels : channels.map(c => c.id),
      audienceType: form.audienceType,
      audienceValue: form.audienceValue || null,
      content: { type: 'text', text: form.text },
      scheduledAt: null,
    }, workspaceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['broadcasts', workspaceId] }); setShowForm(false) },
  })

  const sendBroadcast = useMutation({
    mutationFn: (broadcastId: string) => api.post(`/workspaces/${workspaceId}/broadcasts/${broadcastId}/send`, {}, workspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broadcasts', workspaceId] }),
  })

  const broadcasts = broadcastsData?.data ?? []

  const statusColor: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    scheduled: 'bg-blue-100 text-blue-700',
    sending: 'bg-yellow-100 text-yellow-700',
    sent: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Broadcasts</h1>
          <p className="text-muted-foreground">Send messages to your subscribers</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> New Broadcast
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Create Broadcast</h3>
          <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Broadcast name" className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
          <textarea value={form.text} onChange={(e) => setForm(f => ({ ...f, text: e.target.value }))}
            placeholder="Message text… Use {{first_name}} for personalization" rows={4}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Audience</label>
              <select value={form.audienceType} onChange={(e) => setForm(f => ({ ...f, audienceType: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="all">All Subscribers</option>
                <option value="tag">By Tag</option>
              </select>
            </div>
            {form.audienceType === 'tag' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tag</label>
                <input value={form.audienceValue} onChange={(e) => setForm(f => ({ ...f, audienceValue: e.target.value }))}
                  placeholder="e.g. vip-customer" className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.text}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
          </div>
        </div>
      )}

      {broadcasts.length === 0 && !showForm ? (
        <div className="text-center py-20 text-muted-foreground">
          <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No broadcasts yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b) => (
            <div key={b.id} className="rounded-xl border bg-card p-5 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold">{b.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[b.status] ?? ''}`}>{b.status}</span>
                </div>
                <p className="text-sm text-muted-foreground">{(b.content as { text?: string })?.text?.slice(0, 80)}…</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {b.statsSent}/{b.statsTotal} sent · {b.statsDelivered} delivered · {b.statsRead} read
                </p>
              </div>
              {b.status === 'draft' && (
                <button onClick={() => sendBroadcast.mutate(b.id)}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  disabled={sendBroadcast.isPending}>
                  <Send className="h-4 w-4" /> Send Now
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
