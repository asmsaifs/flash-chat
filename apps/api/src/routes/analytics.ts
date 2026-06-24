import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'

export async function analyticsRoutes(app: FastifyInstance) {
  const preHandler = [authMiddleware, workspaceMiddleware]

  app.get<{ Params: { workspaceId: string }; Querystring: { period?: string } }>(
    '/workspaces/:workspaceId/analytics/overview',
    { preHandler },
    async (req, reply) => {
      const days = Number(req.query.period ?? 30)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const [totalContacts, newContacts, totalConversations, openConversations, totalMessages, outboundMessages] =
        await Promise.all([
          prisma.contact.count({ where: { workspaceId: req.workspaceId } }),
          prisma.contact.count({ where: { workspaceId: req.workspaceId, subscribedAt: { gte: since } } }),
          prisma.conversation.count({ where: { workspaceId: req.workspaceId } }),
          prisma.conversation.count({ where: { workspaceId: req.workspaceId, status: 'open' } }),
          prisma.message.count({ where: { conversation: { workspaceId: req.workspaceId }, sentAt: { gte: since } } }),
          prisma.message.count({ where: { conversation: { workspaceId: req.workspaceId }, sentAt: { gte: since }, direction: 'outbound' } }),
        ])

      return reply.send({
        data: {
          totalContacts,
          newContacts,
          totalConversations,
          openConversations,
          totalMessages,
          outboundMessages,
          period: days,
        },
      })
    }
  )

  app.get<{ Params: { workspaceId: string }; Querystring: { period?: string } }>(
    '/workspaces/:workspaceId/analytics/subscriber-growth',
    { preHandler },
    async (req, reply) => {
      const days = Number(req.query.period ?? 30)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const contacts = await prisma.contact.findMany({
        where: { workspaceId: req.workspaceId, subscribedAt: { gte: since } },
        select: { subscribedAt: true },
        orderBy: { subscribedAt: 'asc' },
      })

      // Group by day
      const byDay: Record<string, number> = {}
      for (const c of contacts) {
        const day = c.subscribedAt.toISOString().split('T')[0]
        byDay[day] = (byDay[day] ?? 0) + 1
      }

      const series = Object.entries(byDay).map(([date, count]) => ({ date, count }))
      return reply.send({ data: series })
    }
  )

  app.get<{ Params: { workspaceId: string; flowId: string } }>(
    '/workspaces/:workspaceId/analytics/flows/:flowId',
    { preHandler },
    async (req, reply) => {
      const [total, completed, failed, waiting] = await Promise.all([
        prisma.flowExecution.count({ where: { flowId: req.params.flowId } }),
        prisma.flowExecution.count({ where: { flowId: req.params.flowId, status: 'completed' } }),
        prisma.flowExecution.count({ where: { flowId: req.params.flowId, status: 'failed' } }),
        prisma.flowExecution.count({ where: { flowId: req.params.flowId, status: 'waiting_input' } }),
      ])

      return reply.send({
        data: {
          total,
          completed,
          failed,
          waiting,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
      })
    }
  )

  app.get<{ Params: { workspaceId: string }; Querystring: { period?: string } }>(
    '/workspaces/:workspaceId/analytics/message-volume',
    { preHandler },
    async (req, reply) => {
      const days = Number(req.query.period ?? 30)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const messages = await prisma.message.findMany({
        where: { conversation: { workspaceId: req.workspaceId }, sentAt: { gte: since } },
        select: { sentAt: true, direction: true },
        orderBy: { sentAt: 'asc' },
      })

      const byDay: Record<string, { inbound: number; outbound: number }> = {}
      for (const m of messages) {
        const day = m.sentAt.toISOString().split('T')[0]
        if (!byDay[day]) byDay[day] = { inbound: 0, outbound: 0 }
        byDay[day][m.direction as 'inbound' | 'outbound']++
      }

      const series = Object.entries(byDay).map(([date, counts]) => ({ date, ...counts }))
      return reply.send({ data: series })
    }
  )

  app.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/analytics/channel-breakdown',
    { preHandler },
    async (req, reply) => {
      const contacts = await prisma.contact.groupBy({
        by: ['channelType'],
        where: { workspaceId: req.workspaceId },
        _count: { id: true },
      })

      const data = contacts.map((c) => ({
        channel: c.channelType,
        contacts: c._count.id,
      }))

      return reply.send({ data })
    }
  )
}
