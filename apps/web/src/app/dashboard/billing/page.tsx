'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { PLAN_LIMITS } from '@flashchat/shared'
import type { PlanName } from '@flashchat/shared'
import { Zap, Check, Loader2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UsageMeter {
  used: number
  limit: number
}

interface BillingData {
  subscription: {
    plan: PlanName
    status: string
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    stripeSubscriptionId: string | null
  } | null
  usage: {
    plan: PlanName
    subscribers: UsageMeter
    broadcasts: UsageMeter
    aiReplies: UsageMeter
  }
}

const PLANS: { name: PlanName; label: string; price: string; features: string[] }[] = [
  {
    name: 'free',
    label: 'Free',
    price: '$0/mo',
    features: ['500 subscribers', '2 broadcasts/month', '100 AI replies/month', 'All channels', 'Flow builder'],
  },
  {
    name: 'pro',
    label: 'Pro',
    price: '$29/mo',
    features: ['5,000 subscribers', 'Unlimited broadcasts', '1,000 AI replies/month', 'All channels', 'Priority support'],
  },
  {
    name: 'business',
    label: 'Business',
    price: '$79/mo',
    features: ['25,000 subscribers', 'Unlimited broadcasts', '10,000 AI replies/month', 'Advanced analytics', 'Team roles'],
  },
  {
    name: 'agency',
    label: 'Agency',
    price: '$199/mo',
    features: ['Unlimited subscribers', 'Unlimited broadcasts', 'Unlimited AI replies', 'White-label', 'API access'],
  },
]

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isUnlimited = limit === Infinity || limit === 0
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100)
  const isNearLimit = pct >= 80
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium', isNearLimit && 'text-destructive')}>
          {used.toLocaleString()} / {isUnlimited ? '∞' : limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        {!isUnlimited && (
          <div
            className={cn('h-full rounded-full transition-all', isNearLimit ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  )
}

export default function BillingPage() {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const [loading, setLoading] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['billing', workspaceId],
    queryFn: () => api.get<{ data: BillingData }>(`/workspaces/${workspaceId}/billing`, workspaceId),
    enabled: !!workspaceId,
  })

  const billing = data?.data
  const currentPlan = billing?.usage.plan ?? 'free'

  async function handleUpgrade(plan: PlanName) {
    if (plan === 'free') return
    setLoading(plan)
    try {
      const returnUrl = window.location.href
      const res = await api.post<{ data: { url: string } }>(
        `/workspaces/${workspaceId}/billing/checkout`,
        { plan, returnUrl },
        workspaceId
      )
      window.location.href = res.data.url
    } catch (err) {
      console.error('Checkout failed:', err)
      setLoading(null)
    }
  }

  async function handleManage() {
    setLoading('portal')
    try {
      const res = await api.post<{ data: { url: string } }>(
        `/workspaces/${workspaceId}/billing/portal`,
        { returnUrl: window.location.href },
        workspaceId
      )
      window.location.href = res.data.url
    } catch (err) {
      console.error('Portal failed:', err)
      setLoading(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your plan and usage</p>
      </div>

      {/* Current plan + usage */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : billing ? (
        <div className="rounded-xl border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="text-xl font-bold capitalize">{currentPlan}</p>
              {billing.subscription?.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {billing.subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'}{' '}
                  {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            {billing.subscription?.stripeSubscriptionId && (
              <button
                type="button"
                onClick={handleManage}
                disabled={loading === 'portal'}
                className="flex items-center gap-2 border px-4 py-2 rounded-md text-sm hover:bg-accent transition-colors disabled:opacity-50"
              >
                {loading === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Manage Subscription
              </button>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">This month's usage</h3>
            <UsageBar label="Subscribers" used={billing.usage.subscribers.used} limit={PLAN_LIMITS[currentPlan].subscribers} />
            <UsageBar label="Broadcasts" used={billing.usage.broadcasts.used} limit={PLAN_LIMITS[currentPlan].broadcasts} />
            <UsageBar label="AI Replies" used={billing.usage.aiReplies.used} limit={PLAN_LIMITS[currentPlan].aiReplies} />
          </div>
        </div>
      ) : null}

      {/* Plan cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.name === currentPlan
            const isPaid = plan.name !== 'free'
            return (
              <div
                key={plan.name}
                className={cn(
                  'rounded-xl border p-5 space-y-4 flex flex-col',
                  isCurrent && 'border-primary ring-1 ring-primary'
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold">{plan.label}</p>
                    {isCurrent && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Current</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold">{plan.price}</p>
                </div>

                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isPaid && !isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={loading === plan.name}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {loading === plan.name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Upgrade
                  </button>
                )}
                {isCurrent && isPaid && (
                  <button
                    type="button"
                    onClick={handleManage}
                    disabled={loading === 'portal'}
                    className="w-full border px-4 py-2 rounded-md text-sm hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    Manage
                  </button>
                )}
                {isCurrent && !isPaid && (
                  <div className="text-xs text-center text-muted-foreground py-1">Free forever</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
