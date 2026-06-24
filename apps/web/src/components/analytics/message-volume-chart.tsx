'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Props { workspaceId: string }

export function MessageVolumeChart({ workspaceId }: Props) {
  const api = useApi()

  const { data } = useQuery({
    queryKey: ['analytics', 'message-volume', workspaceId],
    queryFn: () =>
      api.get<{ data: Array<{ date: string; inbound: number; outbound: number }> }>(
        `/workspaces/${workspaceId}/analytics/message-volume`,
        workspaceId
      ),
    enabled: !!workspaceId,
  })

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="font-semibold mb-4">Message Volume (30d)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data?.data ?? []} barSize={6}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
          <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="inbound" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} />
          <Bar dataKey="outbound" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
