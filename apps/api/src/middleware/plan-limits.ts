import { prisma } from '@flashchat/database'
import { PLAN_LIMITS } from '@flashchat/shared'
import type { PlanName } from '@flashchat/shared'

async function getWorkspacePlan(workspaceId: string): Promise<PlanName> {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId }, select: { plan: true, status: true } })
  if (!sub || sub.status === 'canceled') return 'free'
  return sub.plan as PlanName
}

export async function checkSubscriberLimit(workspaceId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const plan = await getWorkspacePlan(workspaceId)
  const limit = PLAN_LIMITS[plan].subscribers
  if (limit === Infinity) return { allowed: true, used: 0, limit }
  const used = await prisma.contact.count({ where: { workspaceId } })
  return { allowed: used < limit, used, limit }
}

export async function checkBroadcastLimit(workspaceId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const plan = await getWorkspacePlan(workspaceId)
  const limit = PLAN_LIMITS[plan].broadcasts
  if (limit === Infinity) return { allowed: true, used: 0, limit }
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const used = await prisma.broadcast.count({ where: { workspaceId, createdAt: { gte: startOfMonth } } })
  return { allowed: used < limit, used, limit }
}

export async function checkAiReplyLimit(workspaceId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const plan = await getWorkspacePlan(workspaceId)
  const limit = PLAN_LIMITS[plan].aiReplies
  if (limit === Infinity) return { allowed: true, used: 0, limit }
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const used = await prisma.aiUsageLog.count({ where: { workspaceId, createdAt: { gte: startOfMonth } } })
  return { allowed: used < limit, used, limit }
}

export async function getUsageSummary(workspaceId: string) {
  const plan = await getWorkspacePlan(workspaceId)
  const limits = PLAN_LIMITS[plan]
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const [subscribers, broadcasts, aiReplies] = await Promise.all([
    prisma.contact.count({ where: { workspaceId } }),
    prisma.broadcast.count({ where: { workspaceId, createdAt: { gte: startOfMonth } } }),
    prisma.aiUsageLog.count({ where: { workspaceId, createdAt: { gte: startOfMonth } } }),
  ])

  return {
    plan,
    subscribers: { used: subscribers, limit: limits.subscribers },
    broadcasts: { used: broadcasts, limit: limits.broadcasts },
    aiReplies: { used: aiReplies, limit: limits.aiReplies },
  }
}
