'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { StatsCard } from '@/components/analytics/stats-card'
import { SubscriberGrowthChart } from '@/components/analytics/subscriber-growth-chart'
import { RecentConversations } from '@/components/inbox/recent-conversations'
import { MessageSquare, Users, Send, Zap } from 'lucide-react'

export default function DashboardPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()

  const { data: analytics } = useQuery({
    queryKey: ['analytics', 'overview', workspaceId],
    queryFn: () => api.get<{ data: Record<string, number> }>(`/workspaces/${workspaceId}/analytics/overview`, workspaceId),
    enabled: !!workspaceId,
  })

  const stats = analytics?.data

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back — here's what's happening.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Contacts"
          value={stats?.totalContacts ?? 0}
          delta={`+${stats?.newContacts ?? 0} this month`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatsCard
          title="Open Conversations"
          value={stats?.openConversations ?? 0}
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <StatsCard
          title="Messages Sent"
          value={stats?.outboundMessages ?? 0}
          icon={<Send className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Messages"
          value={stats?.totalMessages ?? 0}
          icon={<Zap className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SubscriberGrowthChart workspaceId={workspaceId} />
        <RecentConversations workspaceId={workspaceId} />
      </div>
    </div>
  )
}
