import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { CreateBroadcastSchema } from '@flashchat/shared'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'
import { Queue } from 'bullmq'
import { redis } from '../lib/redis.js'

const broadcastQueue = new Queue('broadcast', { connection: redis as never })

export async function broadcastRoutes(app: FastifyInstance) {
  const preHandler = [authMiddleware, workspaceMiddleware]

  app.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/broadcasts',
    { preHandler },
    async (req, reply) => {
      const broadcasts = await prisma.broadcast.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { createdAt: 'desc' },
        include: { channels: { include: { channel: true } } },
      })
      return reply.send({ data: broadcasts })
    }
  )

  app.post<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/broadcasts',
    { preHandler },
    async (req, reply) => {
      const body = CreateBroadcastSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Validation', message: body.error.message, statusCode: 400 })

      const { channelIds, ...rest } = body.data

      const broadcast = await prisma.broadcast.create({
        data: {
          workspaceId: req.workspaceId,
          name: rest.name,
          audienceType: rest.audienceType,
          audienceTag: rest.audienceValue ?? undefined,
          content: rest.content as object,
          scheduledAt: rest.scheduledAt ? new Date(rest.scheduledAt) : null,
          channels: { create: channelIds.map((channelId) => ({ channelId })) },
        },
        include: { channels: { include: { channel: true } } },
      })

      return reply.status(201).send({ data: broadcast })
    }
  )

  // Send broadcast now
  app.post<{ Params: { workspaceId: string; broadcastId: string } }>(
    '/workspaces/:workspaceId/broadcasts/:broadcastId/send',
    { preHandler },
    async (req, reply) => {
      const broadcast = await prisma.broadcast.findFirstOrThrow({
        where: { id: req.params.broadcastId, workspaceId: req.workspaceId },
      })

      if (broadcast.status !== 'draft') {
        return reply.status(400).send({ error: 'Bad Request', message: 'Broadcast already sent or sending', statusCode: 400 })
      }

      // Build recipient list
      const contacts = await getAudience(req.workspaceId, broadcast.audienceType, broadcast.audienceTag, broadcast.segmentId)

      const isScheduled = broadcast.scheduledAt && new Date(broadcast.scheduledAt) > new Date()
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { status: isScheduled ? 'scheduled' : 'sending', statsTotal: contacts.length },
      })

      const jobDelay = broadcast.scheduledAt
        ? Math.max(0, new Date(broadcast.scheduledAt).getTime() - Date.now())
        : 0

      // Enqueue recipients (delayed if scheduled)
      await broadcastQueue.addBulk(
        contacts.map((contact) => ({
          name: 'send-to-contact',
          data: { broadcastId: broadcast.id, contactId: contact.id, workspaceId: req.workspaceId },
          opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, delay: jobDelay },
        }))
      )

      return reply.send({ data: { queued: contacts.length, scheduledAt: broadcast.scheduledAt } })
    }
  )

  app.get<{ Params: { workspaceId: string; broadcastId: string } }>(
    '/workspaces/:workspaceId/broadcasts/:broadcastId',
    { preHandler },
    async (req, reply) => {
      const broadcast = await prisma.broadcast.findFirstOrThrow({
        where: { id: req.params.broadcastId, workspaceId: req.workspaceId },
        include: { channels: { include: { channel: true } } },
      })
      return reply.send({ data: broadcast })
    }
  )
}

async function getAudience(
  workspaceId: string,
  audienceType: string,
  audienceTag: string | null,
  segmentId: string | null
) {
  if (audienceType === 'all') {
    return prisma.contact.findMany({ where: { workspaceId, isSubscribed: true }, select: { id: true } })
  }
  if (audienceType === 'tag' && audienceTag) {
    return prisma.contact.findMany({ where: { workspaceId, isSubscribed: true, tags: { some: { tag: audienceTag } } }, select: { id: true } })
  }
  return prisma.contact.findMany({ where: { workspaceId, isSubscribed: true }, select: { id: true } })
}
