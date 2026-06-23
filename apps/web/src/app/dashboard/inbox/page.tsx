'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { useSocketEvent } from '@/hooks/use-socket'
import { useQueryClient } from '@tanstack/react-query'
import { formatRelative, initials, cn } from '@/lib/utils'
import type { Conversation, Message } from '@flashchat/shared'

export default function InboxPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const { data } = useQuery({
    queryKey: ['conversations', workspaceId],
    queryFn: () => api.get<{ data: Conversation[] }>(`/workspaces/${workspaceId}/conversations`, workspaceId),
    enabled: !!workspaceId,
  })

  const { data: convData } = useQuery({
    queryKey: ['conversation', activeId],
    queryFn: () => api.get<{ data: Conversation }>(`/workspaces/${workspaceId}/conversations/${activeId}`, workspaceId),
    enabled: !!activeId && !!workspaceId,
  })

  useSocketEvent<{ conversationId: string; message: Message }>('message:new', () => {
    qc.invalidateQueries({ queryKey: ['conversations', workspaceId] })
    if (activeId) qc.invalidateQueries({ queryKey: ['conversation', activeId] })
  })

  const conversations = data?.data ?? []
  const active = convData?.data

  const sendMessage = async () => {
    if (!message.trim() || !activeId) return
    await api.post(`/workspaces/${workspaceId}/conversations/${activeId}/messages`, { content: { type: 'text', text: message } }, workspaceId)
    setMessage('')
    qc.invalidateQueries({ queryKey: ['conversation', activeId] })
  }

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold">Inbox</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const name = [conv.contact?.firstName, conv.contact?.lastName].filter(Boolean).join(' ') || 'Unknown'
            return (
              <button
                key={conv.id}
                onClick={() => setActiveId(conv.id)}
                className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-b', activeId === conv.id && 'bg-accent')}
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <span className="text-xs text-muted-foreground">{conv.lastMessageAt ? formatRelative(conv.lastMessageAt) : ''}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {(conv.lastMessage?.content as { text?: string })?.text ?? ''}
                  </p>
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
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-4 border-b flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
              {initials([active.contact?.firstName, active.contact?.lastName].filter(Boolean).join(' ') || 'U')}
            </div>
            <div>
              <p className="font-semibold">{[active.contact?.firstName, active.contact?.lastName].filter(Boolean).join(' ') || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground capitalize">{active.channel?.type?.replace('_', ' ')}</p>
            </div>
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

          <div className="px-6 py-4 border-t flex gap-3">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message…"
              className="flex-1 border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring bg-background"
            />
            <button
              onClick={sendMessage}
              disabled={!message.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a conversation to start
        </div>
      )}
    </div>
  )
}
