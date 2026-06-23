'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { Radio, Plus, Globe, MessageCircle, Send, Instagram, Facebook } from 'lucide-react'
import type { Channel } from '@flashchat/shared'
import type { ChannelType } from '@flashchat/shared'

const channelIcons: Record<ChannelType, React.ReactNode> = {
  web_widget: <Globe className="h-5 w-5" />,
  whatsapp: <MessageCircle className="h-5 w-5 text-green-500" />,
  telegram: <Send className="h-5 w-5 text-blue-500" />,
  messenger: <Facebook className="h-5 w-5 text-blue-600" />,
  instagram: <Instagram className="h-5 w-5 text-pink-500" />,
}

export default function ChannelsPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [newChannel, setNewChannel] = useState({ type: 'web_widget', name: '', credentials: '{}' })

  const { data } = useQuery({
    queryKey: ['channels', workspaceId],
    queryFn: () => api.get<{ data: Channel[] }>(`/workspaces/${workspaceId}/channels`, workspaceId),
    enabled: !!workspaceId,
  })

  const createChannel = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/channels`, {
      type: newChannel.type,
      name: newChannel.name,
      credentials: JSON.parse(newChannel.credentials),
    }, workspaceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels', workspaceId] }); setShowForm(false) },
  })

  const channels = data?.data ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className="text-muted-foreground">Connect messaging channels</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Connect Channel
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Connect New Channel</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Channel Type</label>
              <select value={newChannel.type} onChange={(e) => setNewChannel(c => ({ ...c, type: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="web_widget">Web Widget</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="messenger">Facebook Messenger</option>
                <option value="instagram">Instagram DM</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <input value={newChannel.name} onChange={(e) => setNewChannel(c => ({ ...c, name: e.target.value }))}
                placeholder="My WhatsApp" className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Credentials (JSON)</label>
            <textarea value={newChannel.credentials} onChange={(e) => setNewChannel(c => ({ ...c, credentials: e.target.value }))}
              rows={4} className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createChannel.mutate()} disabled={createChannel.isPending || !newChannel.name}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
              {createChannel.isPending ? 'Connecting…' : 'Connect'}
            </button>
            <button onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
          </div>
        </div>
      )}

      {channels.length === 0 && !showForm ? (
        <div className="text-center py-20 text-muted-foreground">
          <Radio className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No channels connected yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((ch) => (
            <div key={ch.id} className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  {channelIcons[ch.type as ChannelType]}
                </div>
                <div>
                  <p className="font-semibold">{ch.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{ch.type.replace('_', ' ')}</p>
                </div>
                <span className={`ml-auto text-xs px-2 py-1 rounded-full ${ch.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {ch.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {ch.type === 'web_widget' && (
                <div className="bg-muted rounded-md p-3">
                  <p className="text-xs font-medium mb-1">Embed code</p>
                  <code className="text-xs break-all">{`<script src="https://flashchat.app/widget.js" data-channel="${ch.id}"></script>`}</code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
