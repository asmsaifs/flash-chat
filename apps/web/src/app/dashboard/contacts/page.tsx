'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { formatDate } from '@/lib/utils'
import { Search, Users } from 'lucide-react'
import type { Contact } from '@flashchat/shared'

export default function ContactsPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const [search, setSearch] = useState('')

  const { data } = useQuery({
    queryKey: ['contacts', workspaceId, search],
    queryFn: () => api.get<{ data: Contact[]; meta: { total: number } }>(`/workspaces/${workspaceId}/contacts?search=${encodeURIComponent(search)}`, workspaceId),
    enabled: !!workspaceId,
  })

  const contacts = data?.data ?? []
  const total = data?.meta?.total ?? 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} subscribers</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or phone…"
          className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No contacts found</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Contact</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Channel</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Tags</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Subscribed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">
                      {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {contact.email ?? contact.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-muted px-2 py-1 rounded-full capitalize">
                      {contact.channelType?.replace('_', ' ') ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.slice(0, 3).map((t) => (
                        <span key={typeof t === 'string' ? t : (t as { tag: string }).tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {typeof t === 'string' ? t : (t as { tag: string }).tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(contact.subscribedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
