'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import Link from 'next/link'
import { formatRelative, initials } from '@/lib/utils'
import type { Conversation } from '@flashchat/shared'

interface Props { workspaceId: string }

export function RecentConversations({ workspaceId }: Props) {
  const api = useApi()

  const { data } = useQuery({
    queryKey: ['conversations', 'recent', workspaceId],
    queryFn: () => api.get<{ data: Conversation[] }>(`/workspaces/${workspaceId}/conversations?pageSize=5&status=open`, workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 30_000,
  })

  const conversations = data?.data ?? []

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Recent Conversations</h3>
        <Link href="/dashboard/inbox" className="text-sm text-primary hover:underline">View all</Link>
      </div>
      <div className="space-y-3">
        {conversations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No open conversations</p>
        )}
        {conversations.map((conv) => {
          const name = [conv.contact?.firstName, conv.contact?.lastName].filter(Boolean).join(' ') || 'Unknown'
          return (
            <Link
              key={conv.id}
              href={`/dashboard/inbox/${conv.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
                {initials(name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {(conv.lastMessage?.content as { text?: string })?.text ?? 'No messages'}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {conv.lastMessageAt ? formatRelative(conv.lastMessageAt) : ''}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
