'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { UserButton, useUser } from '@clerk/nextjs'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import {
  LayoutDashboard,
  GitBranch,
  MessageSquare,
  Users,
  Megaphone,
  BarChart3,
  Radio,
  Brain,
  Settings,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/inbox', label: 'Inbox', icon: MessageSquare },
  { href: '/dashboard/flows', label: 'Flows', icon: GitBranch },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/broadcasts', label: 'Broadcasts', icon: Megaphone },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/channels', label: 'Channels', icon: Radio },
  { href: '/dashboard/knowledge-base', label: 'AI Knowledge', icon: Brain },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const api = useApi()
  const { workspaceId, setWorkspaceId } = useWorkspace()
  const { user } = useUser()

  useEffect(() => {
    if (workspaceId) return
    api.get<{ data: Array<{ id: string }> }>('/workspaces').then(async (res) => {
      if (res.data[0]) {
        setWorkspaceId(res.data[0].id)
        return
      }
      // No workspace yet — create one
      const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'My'
      const slug = `workspace-${Date.now()}`
      const created = await api.post<{ data: { id: string } }>('/workspaces', {
        name: `${displayName}'s Workspace`,
        slug,
      })
      setWorkspaceId(created.data.id)
    }).catch((err) => {
      console.error('[workspace-init] failed:', err)
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className="w-[220px] flex flex-col h-full bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
        <Zap className="h-6 w-6 text-purple-400 mr-2" />
        <span className="text-lg font-bold text-white">
          Flash<span className="text-purple-400">Chat</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="h-16 px-5 flex items-center border-t border-sidebar-border">
        <UserButton
          appearance={{ elements: { avatarBox: 'h-8 w-8', userButtonTrigger: 'focus:outline-none' } }}
        />
        <span className="ml-3 text-sm text-sidebar-foreground truncate">Account</span>
      </div>
    </aside>
  )
}
