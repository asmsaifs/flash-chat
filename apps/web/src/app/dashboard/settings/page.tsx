'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { AI_MODELS } from '@flashchat/shared'
import type { WorkspaceMember } from '@flashchat/shared'
import { useState, useEffect } from 'react'
import { Trash2, UserPlus, Key, Eye, EyeOff, Copy, Check } from 'lucide-react'

interface ApiKeyRecord {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = { owner: 'Owner', admin: 'Admin', agent: 'Agent' }
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  agent: 'bg-muted text-muted-foreground',
}

export default function SettingsPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.get<{ data: { name: string; aiModel: string; slug: string } }>(`/workspaces/${workspaceId}`, workspaceId),
    enabled: !!workspaceId,
  })

  const { data: membersData } = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () => api.get<{ data: WorkspaceMember[] }>(`/workspaces/${workspaceId}/members`, workspaceId),
    enabled: !!workspaceId,
  })

  const { data: apiKeysData } = useQuery({
    queryKey: ['api-keys', workspaceId],
    queryFn: () => api.get<{ data: ApiKeyRecord[] }>(`/workspaces/${workspaceId}/api-keys`, workspaceId),
    enabled: !!workspaceId,
  })

  const ws = data?.data
  const members = membersData?.data ?? []
  const apiKeys = apiKeysData?.data ?? []

  const [name, setName] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent'>('agent')
  const [newKeyName, setNewKeyName] = useState('')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  useEffect(() => {
    if (ws) { setName(ws.name); setAiModel(ws.aiModel) }
  }, [ws])

  const save = useMutation({
    mutationFn: () => api.patch(`/workspaces/${workspaceId}`, { name, aiModel }, workspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace', workspaceId] }),
  })

  const invite = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/members/invite`, { email: inviteEmail, role: inviteRole }, workspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', workspaceId] })
      setInviteEmail('')
    },
  })

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/workspaces/${workspaceId}/members/${memberId}`, workspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', workspaceId] }),
  })

  const createApiKey = useMutation({
    mutationFn: () => api.post<{ data: { id: string; name: string; keyPrefix: string; key: string } }>(
      `/workspaces/${workspaceId}/api-keys`,
      { name: newKeyName || 'API Key' },
      workspaceId
    ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['api-keys', workspaceId] })
      setNewKeyName('')
      setRevealedKey(res.data.key)
    },
  })

  const revokeApiKey = useMutation({
    mutationFn: (keyId: string) => api.delete(`/workspaces/${workspaceId}/api-keys/${keyId}`, workspaceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys', workspaceId] }),
  })

  function copyKey(key: string) {
    navigator.clipboard.writeText(key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

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
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            title="Workspace Name"
            placeholder="My Workspace"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          />
        </div>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">AI Configuration</h2>
        <p className="text-sm text-muted-foreground">Choose the AI model used for auto-replies and flow suggestions.</p>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="ai-model-select">Model</label>
          <select
            id="ai-model-select"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          >
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save AI Settings'}
        </button>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Team Members</h2>

        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2 border-b last:border-0">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                {m.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] ?? 'bg-muted text-muted-foreground'}`}>
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
              {m.role !== 'owner' && (
                <button
                  type="button"
                  onClick={() => removeMember.mutate(m.id)}
                  title="Remove member"
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="pt-2 border-t space-y-3">
          <p className="text-sm font-medium">Invite team member</p>
          <div className="flex gap-2">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              title="Email address to invite"
              className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'agent')}
              title="Role"
              className="border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              onClick={() => invite.mutate()}
              disabled={invite.isPending || !inviteEmail.trim()}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {invite.isPending ? 'Inviting…' : 'Invite'}
            </button>
          </div>
          {invite.isSuccess && (
            <p className="text-xs text-green-600">Invitation sent! They will receive an email to join.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Key className="h-4 w-4" /> API Keys</h2>
        <p className="text-sm text-muted-foreground">Use API keys to authenticate external integrations. Keys are shown once — copy immediately.</p>

        {revealedKey && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-yellow-800">New key — copy now, it won't be shown again:</p>
            <div className="flex items-center gap-2 bg-white border rounded-md px-3 py-2">
              <code className="text-xs flex-1 break-all font-mono">{revealedKey}</code>
              <button type="button" onClick={() => copyKey(revealedKey)} className="shrink-0 text-muted-foreground hover:text-foreground">
                {copiedKey ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => setRevealedKey(null)} title="Dismiss" className="shrink-0 text-muted-foreground hover:text-foreground">
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {apiKeys.length === 0 && <p className="text-sm text-muted-foreground">No API keys yet.</p>}
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 py-2 border-b last:border-0">
              <code className="text-sm font-mono flex-1">{k.keyPrefix}••••••••</code>
              <span className="text-sm text-muted-foreground truncate max-w-[120px]">{k.name}</span>
              {k.lastUsedAt && (
                <span className="text-xs text-muted-foreground shrink-0">
                  Used {new Date(k.lastUsedAt).toLocaleDateString()}
                </span>
              )}
              <button
                type="button"
                onClick={() => revokeApiKey.mutate(k.id)}
                title="Revoke key"
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t flex gap-2">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. Production)"
            title="API key name"
            className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
          />
          <button
            type="button"
            onClick={() => createApiKey.mutate()}
            disabled={createApiKey.isPending}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            <Key className="h-4 w-4" />
            {createApiKey.isPending ? 'Creating…' : 'Create Key'}
          </button>
        </div>
      </div>
    </div>
  )
}
