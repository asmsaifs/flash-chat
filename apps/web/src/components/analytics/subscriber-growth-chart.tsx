'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props { workspaceId: string }

export function SubscriberGrowthChart({ workspaceId }: Props) {
  const api = useApi()

  const { data } = useQuery({
    queryKey: ['analytics', 'subscriber-growth', workspaceId],
    queryFn: () => api.get<{ data: Array<{ date: string; count: number }> }>(`/workspaces/${workspaceId}/analytics/subscriber-growth`, workspaceId),
    enabled: !!workspaceId,
  })

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="font-semibold mb-4">Subscriber Growth (30d)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data?.data ?? []}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
          <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
          />
          <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
