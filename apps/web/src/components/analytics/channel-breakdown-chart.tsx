'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CHANNEL_COLORS: Record<string, string> = {
  web_widget: '#6366f1',
  whatsapp: '#22c55e',
  telegram: '#0ea5e9',
  messenger: '#3b82f6',
  instagram: '#ec4899',
}

interface Props { workspaceId: string }

export function ChannelBreakdownChart({ workspaceId }: Props) {
  const api = useApi()

  const { data } = useQuery({
    queryKey: ['analytics', 'channel-breakdown', workspaceId],
    queryFn: () =>
      api.get<{ data: Array<{ channel: string; contacts: number }> }>(
        `/workspaces/${workspaceId}/analytics/channel-breakdown`,
        workspaceId
      ),
    enabled: !!workspaceId,
  })

  const chartData = data?.data ?? []

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="font-semibold mb-4">Contacts by Channel</h3>
      {chartData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="channel" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
            />
            <Bar dataKey="contacts" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel] ?? 'hsl(var(--primary))'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
