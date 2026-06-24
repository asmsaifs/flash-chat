'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { Radio, Plus, Globe, MessageCircle, Send, Instagram, Facebook, Copy, Check, Power, Trash2 } from 'lucide-react'
import type { Channel } from '@flashchat/shared'
import type { ChannelType } from '@flashchat/shared'
import { MetaEmbeddedSignup } from '@/components/channels/meta-embedded-signup'
import { TelegramSignup } from '@/components/channels/telegram-signup'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const channelIcons: Record<ChannelType, React.ReactNode> = {
  web_widget: <Globe className="h-5 w-5" />,
  whatsapp: <MessageCircle className="h-5 w-5 text-green-500" />,
  telegram: <Send className="h-5 w-5 text-blue-500" />,
  messenger: <Facebook className="h-5 w-5 text-blue-600" />,
  instagram: <Instagram className="h-5 w-5 text-pink-500" />,
}

type CredentialFields = Record<string, { label: string; placeholder: string; secret?: boolean }>

const CHANNEL_CRED_FIELDS: Partial<Record<ChannelType, CredentialFields>> = {}

const META_CHANNEL_TYPES: ChannelType[] = ['messenger', 'whatsapp', 'instagram']

function webhookUrl(type: ChannelType, channelId: string): string | null {
  switch (type) {
    case 'telegram': return `${API_URL}/webhook/telegram/${channelId}`
    case 'whatsapp': return `${API_URL}/webhook/whatsapp/${channelId}`
    case 'messenger':
    case 'instagram': return `${API_URL}/webhook/meta/${channelId}`
    default: return null
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={copy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function ChannelCard({ ch, onToggle, onDelete }: { ch: Channel; onToggle: () => void; onDelete: () => void }) {
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  const wh = webhookUrl(ch.type as ChannelType, ch.id)

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
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
        <button
          type="button"
          onClick={onToggle}
          title={ch.isActive ? 'Disable channel' : 'Enable channel'}
          className={`shrink-0 p-1.5 rounded-md transition-colors ${ch.isActive ? 'text-muted-foreground hover:text-foreground hover:bg-muted' : 'text-primary hover:bg-primary/10'}`}
        >
          <Power className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete channel"
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {ch.type === 'web_widget' && (
        <div className="bg-muted rounded-md p-3 space-y-1">
          <p className="text-xs font-medium">Embed code</p>
          <div className="flex items-center gap-2">
            <code className="text-xs break-all flex-1">{`<script src="${appOrigin}/widget.js" data-channel="${ch.id}" data-api="${API_URL}"></script>`}</code>
            <CopyButton value={`<script src="${appOrigin}/widget.js" data-channel="${ch.id}" data-api="${API_URL}"></script>`} />
          </div>
        </div>
      )}

      {wh && (
        <div className="bg-muted rounded-md p-3 space-y-1">
          <p className="text-xs font-medium">Webhook URL</p>
          <div className="flex items-center gap-2">
            <code className="text-xs break-all flex-1">{wh}</code>
            <CopyButton value={wh} />
          </div>
          {(ch.type === 'telegram') && (
            <p className="text-xs text-muted-foreground mt-1">
              Webhook registered automatically on connect.
            </p>
          )}
          {(ch.type === 'whatsapp' || ch.type === 'messenger' || ch.type === 'instagram') && (
            <p className="text-xs text-muted-foreground mt-1">
              Add this URL in Meta Developer Portal → Webhooks. Use your verify token to confirm.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChannelsPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [channelType, setChannelType] = useState<ChannelType>('web_widget')
  const [name, setName] = useState('')
  const [credValues, setCredValues] = useState<Record<string, string>>({})

  const { data } = useQuery({
    queryKey: ['channels', workspaceId],
    queryFn: () => api.get<{ data: Channel[] }>(`/workspaces/${workspaceId}/channels`, workspaceId),
    enabled: !!workspaceId,
  })

  const toggleChannel = useMutation({
    mutationFn: (ch: Channel) =>
      api.patch(`/workspaces/${workspaceId}/channels/${ch.id}`, { isActive: !ch.isActive }, workspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', workspaceId] }),
  })

  const deleteChannel = useMutation({
    mutationFn: (channelId: string) =>
      api.delete(`/workspaces/${workspaceId}/channels/${channelId}`, workspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', workspaceId] }),
  })

  const createChannel = useMutation({
    mutationFn: () => {
      const credFields = CHANNEL_CRED_FIELDS[channelType]
      const credentials = credFields
        ? Object.fromEntries(Object.entries(credValues).filter(([, v]) => v.trim()))
        : {}
      return api.post(`/workspaces/${workspaceId}/channels`, { type: channelType, name, credentials }, workspaceId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels', workspaceId] })
      setShowForm(false)
      setName('')
      setCredValues({})
    },
  })

  const channels = data?.data ?? []
  const credFields = CHANNEL_CRED_FIELDS[channelType]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className="text-muted-foreground">Connect messaging channels</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Connect Channel
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Connect New Channel</h3>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Channel Type</label>
            <select
              aria-label="Channel Type"
              value={channelType}
              onChange={(e) => { setChannelType(e.target.value as ChannelType); setCredValues({}) }}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="web_widget">Web Widget</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
              <option value="messenger">Facebook Messenger</option>
              <option value="instagram">Instagram DM</option>
            </select>
          </div>

          {channelType === 'telegram' ? (
            <TelegramSignup
              onSuccess={() => {
                qc.invalidateQueries({ queryKey: ['channels', workspaceId] })
                setShowForm(false)
              }}
              onCancel={() => setShowForm(false)}
            />
          ) : META_CHANNEL_TYPES.includes(channelType) ? (
            <MetaEmbeddedSignup
              channelType={channelType as 'messenger' | 'whatsapp' | 'instagram'}
              onSuccess={() => {
                qc.invalidateQueries({ queryKey: ['channels', workspaceId] })
                setShowForm(false)
              }}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Channel"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                />
              </div>

              {credFields && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credentials</p>
                  {Object.entries(credFields).map(([key, field]) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
                      <input
                        type={field.secret ? 'password' : 'text'}
                        value={credValues[key] ?? ''}
                        onChange={(e) => setCredValues((v) => ({ ...v, [key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono"
                      />
                    </div>
                  ))}
                </div>
              )}

              {channelType === 'web_widget' && (
                <p className="text-xs text-muted-foreground">No credentials needed — the embed code will appear after creation.</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => createChannel.mutate()}
                  disabled={createChannel.isPending || !name}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {createChannel.isPending ? 'Connecting…' : 'Connect'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
              </div>
            </>
          )}
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
            <ChannelCard
              key={ch.id}
              ch={ch}
              onToggle={() => toggleChannel.mutate(ch)}
              onDelete={() => {
                if (window.confirm(`Delete channel "${ch.name}"? This cannot be undone.`)) {
                  deleteChannel.mutate(ch.id)
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
