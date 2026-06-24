'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { useSocketEvent } from '@/hooks/use-socket'
import { formatRelative, initials, cn } from '@/lib/utils'
import { CheckCheck, Sparkles, Loader2, UserCheck, Clock, ChevronDown } from 'lucide-react'
import type { Conversation, Message, WorkspaceMember } from '@flashchat/shared'

type StatusFilter = 'all' | 'open' | 'assigned' | 'resolved'

const SNOOZE_OPTIONS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
]

export default function InboxPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('open')
  const [suggesting, setSuggesting] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const snoozeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) {
        setSnoozeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data } = useQuery({
    queryKey: ['conversations', workspaceId, filter],
    queryFn: () => {
      const status = filter === 'all' ? '' : `&status=${filter}`
      return api.get<{ data: Conversation[] }>(`/workspaces/${workspaceId}/conversations?pageSize=50${status}`, workspaceId)
    },
    enabled: !!workspaceId,
  })

  const { data: convData } = useQuery({
    queryKey: ['conversation', activeId],
    queryFn: () => api.get<{ data: Conversation }>(`/workspaces/${workspaceId}/conversations/${activeId}`, workspaceId),
    enabled: !!activeId && !!workspaceId,
  })

  const { data: membersData } = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () => api.get<{ data: WorkspaceMember[] }>(`/workspaces/${workspaceId}/members`, workspaceId),
    enabled: !!workspaceId,
  })

  useSocketEvent<{ conversationId: string; message: Message }>('message:new', () => {
    qc.invalidateQueries({ queryKey: ['conversations', workspaceId] })
    if (activeId) qc.invalidateQueries({ queryKey: ['conversation', activeId] })
  })

  useSocketEvent<{ conversation: Conversation }>('conversation:updated', () => {
    qc.invalidateQueries({ queryKey: ['conversations', workspaceId] })
    if (activeId) qc.invalidateQueries({ queryKey: ['conversation', activeId] })
  })

  const conversations = data?.data ?? []
  const active = convData?.data
  const members = membersData?.data ?? []

  const sendMessage = async () => {
    if (!message.trim() || !activeId) return
    await api.post(`/workspaces/${workspaceId}/conversations/${activeId}/messages`, { content: { type: 'text', text: message } }, workspaceId)
    setMessage('')
    qc.invalidateQueries({ queryKey: ['conversation', activeId] })
  }

  const patchConversation = useMutation({
    mutationFn: (data: { status?: string; assignedAgentId?: string | null; snoozedUntil?: string | null }) =>
      api.patch(`/workspaces/${workspaceId}/conversations/${activeId}`, data, workspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', workspaceId] })
      qc.invalidateQueries({ queryKey: ['conversation', activeId] })
    },
  })

  const resolve = () => patchConversation.mutate({ status: 'resolved' })

  const assignAgent = (memberId: string | null) =>
    patchConversation.mutate({
      assignedAgentId: memberId,
      status: memberId ? 'assigned' : 'open',
    })

  const snooze = (ms: number) => {
    patchConversation.mutate({ status: 'snoozed', snoozedUntil: new Date(Date.now() + ms).toISOString() })
    setSnoozeOpen(false)
  }

  const filterLabels: { value: StatusFilter; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'all', label: 'All' },
    { value: 'resolved', label: 'Resolved' },
  ]

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold mb-3">Inbox</h1>
          <div className="flex gap-1">
            {filterLabels.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => { setFilter(f.value); setActiveId(null) }}
                className={cn(
                  'flex-1 text-xs py-1.5 rounded-md font-medium transition-colors',
                  filter === f.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No conversations</p>
          )}
          {conversations.map((conv) => {
            const name = [conv.contact?.firstName, conv.contact?.lastName].filter(Boolean).join(' ') || 'Unknown'
            const assigned = (conv as Conversation & { assignedAgent?: WorkspaceMember | null }).assignedAgent
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => setActiveId(conv.id)}
                className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-b', activeId === conv.id && 'bg-accent')}
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{conv.lastMessageAt ? formatRelative(conv.lastMessageAt) : ''}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {(conv.lastMessage?.content as { text?: string })?.text ?? ''}
                  </p>
                  {assigned && (
                    <p className="text-xs text-primary/70 truncate flex items-center gap-1 mt-0.5">
                      <UserCheck className="h-3 w-3 shrink-0" />
                      {assigned.name}
                    </p>
                  )}
                </div>
                {(conv.unreadCount ?? 0) > 0 && (
                  <span className="h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Message thread */}
      {active ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-6 py-4 border-b flex items-center gap-3 flex-wrap">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
              {initials([active.contact?.firstName, active.contact?.lastName].filter(Boolean).join(' ') || 'U')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{[active.contact?.firstName, active.contact?.lastName].filter(Boolean).join(' ') || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground capitalize">{active.channel?.type?.replace('_', ' ')}</p>
            </div>

            {active.status !== 'resolved' && (
              <>
                {/* Agent assignment */}
                <select
                  value={(active as Conversation & { assignedAgentId?: string | null }).assignedAgentId ?? ''}
                  onChange={(e) => assignAgent(e.target.value || null)}
                  title="Assign to agent"
                  className="text-xs border rounded-md px-2 py-1.5 bg-background max-w-[140px]"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>

                {/* Snooze */}
                <div className="relative" ref={snoozeRef}>
                  <button
                    type="button"
                    onClick={() => setSnoozeOpen((o) => !o)}
                    title="Snooze conversation"
                    className="flex items-center gap-1 text-xs border px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Snooze
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {snoozeOpen && (
                    <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-md overflow-hidden min-w-[130px]">
                      {SNOOZE_OPTIONS.map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => snooze(opt.ms)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resolve */}
                <button
                  type="button"
                  onClick={resolve}
                  disabled={patchConversation.isPending}
                  className="flex items-center gap-1.5 text-sm border px-3 py-1.5 rounded-md hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="h-4 w-4" />
                  Resolve
                </button>
              </>
            )}
            {active.status === 'resolved' && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Resolved</span>
            )}
            {active.status === 'snoozed' && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full flex items-center gap-1">
                <Clock className="h-3 w-3" /> Snoozed
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {active.messages?.map((msg) => {
              const content = msg.content as { text?: string }
              const isOut = msg.direction === 'outbound'
              return (
                <div key={msg.id} className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[75%] rounded-2xl px-4 py-2 text-sm', isOut ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm')}>
                    {content.text}
                  </div>
                </div>
              )
            })}
          </div>

          {active.status !== 'resolved' && (
            <div className="px-6 py-4 border-t space-y-2">
              <div className="flex gap-3">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message…"
                  title="Message"
                  className="flex-1 border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring bg-background"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!message.trim()}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Send
                </button>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!activeId) return
                  setSuggesting(true)
                  try {
                    const res = await api.post<{ data: { suggestion: string } }>(
                      `/workspaces/${workspaceId}/conversations/${activeId}/ai-suggest`,
                      {},
                      workspaceId
                    )
                    setMessage(res.data.suggestion)
                  } finally {
                    setSuggesting(false)
                  }
                }}
                disabled={suggesting}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {suggesting ? 'Generating suggestion…' : 'Suggest with AI'}
              </button>
            </div>
          )}
          {active.status === 'resolved' && (
            <div className="px-6 py-4 border-t text-center text-sm text-muted-foreground">
              Conversation resolved
            </div>
          )}
          {active.status === 'snoozed' && (
            <div className="px-6 py-4 border-t text-center space-y-2">
              <p className="text-sm text-muted-foreground">Conversation snoozed</p>
              <button
                type="button"
                onClick={() => patchConversation.mutate({ status: 'open', snoozedUntil: null })}
                className="text-xs text-primary hover:underline"
              >
                Wake up now
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a conversation to start
        </div>
      )}
    </div>
  )
}
