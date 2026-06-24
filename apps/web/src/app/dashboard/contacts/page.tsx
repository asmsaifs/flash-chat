'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { formatDate } from '@/lib/utils'
import {
  Search, Users, ChevronLeft, ChevronRight, Upload, X, Tag, Plus, BellOff, Bell,
  ExternalLink, MessageSquare,
} from 'lucide-react'
import type { Contact } from '@flashchat/shared'

const PAGE_SIZE = 25

type ContactWithTags = Contact & { tags: Array<{ tag: string }> }
type ContactDetail = ContactWithTags & {
  conversations: Array<{ id: string; status: string; lastMessageAt: string | null; channel: { name: string; type: string } }>
}

function parseCSV(text: string): Array<{ firstName?: string; lastName?: string; email?: string; phone?: string; tags?: string[] }> {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ''))
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { if (cols[i]) row[h] = cols[i] })
    const tags = row['tags'] ? row['tags'].split('|').map((t) => t.trim()).filter(Boolean) : undefined
    return {
      firstName: row['firstname'] || row['first_name'] || undefined,
      lastName: row['lastname'] || row['last_name'] || undefined,
      email: row['email'] || undefined,
      phone: row['phone'] || undefined,
      tags,
    }
  }).filter((r) => r.email || r.phone)
}

export default function ContactsPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [selected, setSelected] = useState<ContactWithTags | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; total: number } | null>(null)
  const [newTag, setNewTag] = useState('')

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t)
    ;(handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => setDebouncedSearch(value), 300)
  }

  const handleTagFilter = (tag: string | null) => {
    setActiveTag(tag)
    setPage(1)
  }

  const { data } = useQuery({
    queryKey: ['contacts', workspaceId, debouncedSearch, page, activeTag],
    queryFn: () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (activeTag) params.set('tag', activeTag)
      return api.get<{ data: ContactWithTags[]; meta: { total: number; page: number; pageSize: number } }>(
        `/workspaces/${workspaceId}/contacts?${params}`,
        workspaceId
      )
    },
    enabled: !!workspaceId,
  })

  const { data: tagsData } = useQuery({
    queryKey: ['contacts-tags', workspaceId],
    queryFn: () => api.get<{ data: string[] }>(`/workspaces/${workspaceId}/contacts/tags`, workspaceId),
    enabled: !!workspaceId,
  })

  const { data: detailData } = useQuery({
    queryKey: ['contact-detail', workspaceId, selected?.id],
    queryFn: () =>
      api.get<{ data: ContactDetail }>(`/workspaces/${workspaceId}/contacts/${selected!.id}`, workspaceId),
    enabled: !!selected?.id,
  })

  const contacts = data?.data ?? []
  const total = data?.meta?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const allTags = tagsData?.data ?? []
  const detail = detailData?.data ?? null

  const toggleSubscribe = useMutation({
    mutationFn: ({ id, isSubscribed }: { id: string; isSubscribed: boolean }) =>
      api.patch(`/workspaces/${workspaceId}/contacts/${id}`, { isSubscribed }, workspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts', workspaceId] })
      if (selected) qc.invalidateQueries({ queryKey: ['contact-detail', workspaceId, selected.id] })
    },
  })

  const addTag = useMutation({
    mutationFn: ({ contactId, tag }: { contactId: string; tag: string }) =>
      api.post(`/workspaces/${workspaceId}/contacts/${contactId}/tags`, { tag }, workspaceId),
    onSuccess: () => {
      if (selected) qc.invalidateQueries({ queryKey: ['contact-detail', workspaceId, selected.id] })
      qc.invalidateQueries({ queryKey: ['contacts-tags', workspaceId] })
      setNewTag('')
    },
  })

  const removeTag = useMutation({
    mutationFn: ({ contactId, tag }: { contactId: string; tag: string }) =>
      api.delete(`/workspaces/${workspaceId}/contacts/${contactId}/tags/${encodeURIComponent(tag)}`, workspaceId),
    onSuccess: () => {
      if (selected) qc.invalidateQueries({ queryKey: ['contact-detail', workspaceId, selected.id] })
      qc.invalidateQueries({ queryKey: ['contacts-tags', workspaceId] })
    },
  })

  const importContacts = useMutation({
    mutationFn: (rows: ReturnType<typeof parseCSV>) =>
      api.post<{ data: { imported: number; failed: number; total: number } }>(
        `/workspaces/${workspaceId}/contacts/import`,
        { contacts: rows },
        workspaceId
      ),
    onSuccess: (res) => {
      setImportResult(res.data)
      qc.invalidateQueries({ queryKey: ['contacts', workspaceId] })
      qc.invalidateQueries({ queryKey: ['contacts-tags', workspaceId] })
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        setImportResult({ imported: 0, failed: 0, total: 0 })
        return
      }
      importContacts.mutate(parsed)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const contactName = (c: Contact) =>
    [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown'

  const tagLabel = (t: string | { tag: string }) => typeof t === 'string' ? t : t.tag

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 p-6 space-y-4 overflow-y-auto min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contacts</h1>
            <p className="text-muted-foreground">{total.toLocaleString()} subscribers</p>
          </div>
          <div className="flex items-center gap-2">
            {importResult && (
              <span className="text-xs text-muted-foreground border rounded-md px-3 py-1.5">
                Imported {importResult.imported}/{importResult.total}
                {importResult.failed > 0 && ` · ${importResult.failed} failed`}
              </span>
            )}
            <label className="sr-only" htmlFor="csv-import">Import CSV file</label>
            <input id="csv-import" ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            <button
              type="button"
              onClick={() => { setImportResult(null); fileRef.current?.click() }}
              disabled={importContacts.isPending}
              className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importContacts.isPending ? 'Importing…' : 'Import CSV'}
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Tag filter pills */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleTagFilter(null)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeTag === null ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => handleTagFilter(activeTag === tag ? null : tag)}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  activeTag === tag ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                }`}
              >
                <Tag className="h-3 w-3" />
                {tag}
              </button>
            ))}
          </div>
        )}

        {contacts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No contacts found</p>
            <p className="text-xs mt-1">Import a CSV or wait for subscribers via your channels</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Contact</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Channel</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Tags</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Subscribed</th>
                    <th className="px-4 py-3" scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setSelected(contact)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{contactName(contact)}</p>
                        {!contact.isSubscribed && (
                          <span className="text-xs text-muted-foreground">Unsubscribed</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {contact.email ?? contact.phone ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-muted px-2 py-1 rounded-full capitalize">
                          {contact.channelType?.replace('_', ' ') ?? 'manual'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags?.slice(0, 3).map((t) => (
                            <span
                              key={tagLabel(t)}
                              className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                            >
                              {tagLabel(t)}
                            </span>
                          ))}
                          {(contact.tags?.length ?? 0) > 3 && (
                            <span className="text-xs text-muted-foreground">+{contact.tags.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(contact.subscribedAt)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title={contact.isSubscribed ? 'Unsubscribe' : 'Resubscribe'}
                          onClick={() => toggleSubscribe.mutate({ id: contact.id, isSubscribed: !contact.isSubscribed })}
                          className={`p-1.5 rounded-md transition-colors ${
                            contact.isSubscribed
                              ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {contact.isSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{from}–{to} of {total.toLocaleString()}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  title="Previous page"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md border hover:bg-accent disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Next page"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-md border hover:bg-accent disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Contact detail slide-out */}
      {selected && (
        <div className="w-80 border-l bg-card flex flex-col overflow-hidden flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">{contactName(selected)}</h3>
            <button type="button" title="Close" onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Info */}
            <div className="space-y-2 text-sm">
              {(detail?.email ?? selected.email) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium truncate ml-2">{detail?.email ?? selected.email}</span>
                </div>
              )}
              {(detail?.phone ?? selected.phone) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{detail?.phone ?? selected.phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channel</span>
                <span className="capitalize">
                  {(detail?.channelType ?? selected.channelType)?.replace('_', ' ') ?? 'manual'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <div className="flex items-center gap-2">
                  <span className={(detail?.isSubscribed ?? selected.isSubscribed) ? 'text-green-600' : 'text-muted-foreground'}>
                    {(detail?.isSubscribed ?? selected.isSubscribed) ? 'Subscribed' : 'Unsubscribed'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSubscribe.mutate({
                      id: selected.id,
                      isSubscribed: !(detail?.isSubscribed ?? selected.isSubscribed),
                    })}
                    className="text-xs border px-2 py-0.5 rounded hover:bg-accent"
                  >
                    {(detail?.isSubscribed ?? selected.isSubscribed) ? 'Unsub' : 'Resub'}
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span>{formatDate(detail?.subscribedAt ?? selected.subscribedAt)}</span>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tags</h4>
              <div className="flex flex-wrap gap-1.5">
                {((detail?.tags ?? selected.tags) ?? []).map((t) => {
                  const tag = tagLabel(t)
                  return (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {tag}
                      <button
                        type="button"
                        title={`Remove tag ${tag}`}
                        onClick={() => removeTag.mutate({ contactId: selected.id, tag })}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )
                })}
                {((detail?.tags ?? selected.tags)?.length ?? 0) === 0 && (
                  <span className="text-xs text-muted-foreground">No tags</span>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newTag.trim()) addTag.mutate({ contactId: selected.id, tag: newTag.trim() })
                }}
                className="flex gap-2"
              >
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag…"
                  className="flex-1 text-xs border rounded-md px-2 py-1.5 bg-background outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="submit"
                  title="Add tag"
                  disabled={!newTag.trim() || addTag.isPending}
                  className="p-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>

            {/* Recent conversations */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Conversations</h4>
              {(detail?.conversations ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{detail ? 'No conversations' : 'Loading…'}</p>
              ) : (
                <div className="space-y-2">
                  {(detail?.conversations ?? []).map((conv) => (
                    <a
                      key={conv.id}
                      href={`/dashboard/inbox?conversation=${conv.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium capitalize">{conv.channel?.name ?? conv.channel?.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {conv.status} · {conv.lastMessageAt ? formatDate(conv.lastMessageAt) : 'No messages'}
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
