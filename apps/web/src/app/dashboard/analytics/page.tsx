'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { StatsCard } from '@/components/analytics/stats-card'
import { SubscriberGrowthChart } from '@/components/analytics/subscriber-growth-chart'
import { BarChart3, MessageSquare, Users, Send, Zap } from 'lucide-react'

export default function AnalyticsPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()

  const { data: overview7 } = useQuery({
    queryKey: ['analytics', 'overview', workspaceId, 7],
    queryFn: () => api.get<{ data: Record<string, number> }>(`/workspaces/${workspaceId}/analytics/overview?period=7`, workspaceId),
    enabled: !!workspaceId,
  })

  const { data: overview30 } = useQuery({
    queryKey: ['analytics', 'overview', workspaceId, 30],
    queryFn: () => api.get<{ data: Record<string, number> }>(`/workspaces/${workspaceId}/analytics/overview?period=30`, workspaceId),
    enabled: !!workspaceId,
  })

  const s7 = overview7?.data ?? {}
  const s30 = overview30?.data ?? {}

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Track performance and growth</p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Last 7 days</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="New Contacts" value={s7.newContacts ?? 0} icon={<Users className="h-5 w-5" />} />
          <StatsCard title="Conversations" value={s7.totalConversations ?? 0} icon={<MessageSquare className="h-5 w-5" />} />
          <StatsCard title="Messages Sent" value={s7.outboundMessages ?? 0} icon={<Send className="h-5 w-5" />} />
          <StatsCard title="Total Messages" value={s7.totalMessages ?? 0} icon={<Zap className="h-5 w-5" />} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Last 30 days</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="New Contacts" value={s30.newContacts ?? 0} icon={<Users className="h-5 w-5" />} />
          <StatsCard title="Conversations" value={s30.totalConversations ?? 0} icon={<MessageSquare className="h-5 w-5" />} />
          <StatsCard title="Messages Sent" value={s30.outboundMessages ?? 0} icon={<Send className="h-5 w-5" />} />
          <StatsCard title="Total Messages" value={s30.totalMessages ?? 0} icon={<Zap className="h-5 w-5" />} />
        </div>
      </div>

      <SubscriberGrowthChart workspaceId={workspaceId} />
    </div>
  )
}
