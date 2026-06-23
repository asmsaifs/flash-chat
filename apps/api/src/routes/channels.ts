import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { CreateChannelSchema } from '@flashchat/shared'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'

export async function channelRoutes(app: FastifyInstance) {
  const preHandler = [authMiddleware, workspaceMiddleware]

  app.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/channels',
    { preHandler },
    async (req, reply) => {
      const channels = await prisma.channel.findMany({
        where: { workspaceId: req.workspaceId },
        select: { id: true, type: true, name: true, isActive: true, widgetConfig: true, createdAt: true },
      })
      return reply.send({ data: channels })
    }
  )

  app.post<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/channels',
    { preHandler },
    async (req, reply) => {
      const body = CreateChannelSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Validation', message: body.error.message, statusCode: 400 })

      const channel = await prisma.channel.create({
        data: { workspaceId: req.workspaceId, ...body.data },
        select: { id: true, type: true, name: true, isActive: true, widgetConfig: true, createdAt: true },
      })
      return reply.status(201).send({ data: channel })
    }
  )

  app.patch<{ Params: { workspaceId: string; channelId: string } }>(
    '/workspaces/:workspaceId/channels/:channelId',
    { preHandler },
    async (req, reply) => {
      const channel = await prisma.channel.update({
        where: { id: req.params.channelId },
        data: req.body as object,
        select: { id: true, type: true, name: true, isActive: true, widgetConfig: true, createdAt: true },
      })
      return reply.send({ data: channel })
    }
  )

  app.delete<{ Params: { workspaceId: string; channelId: string } }>(
    '/workspaces/:workspaceId/channels/:channelId',
    { preHandler },
    async (req, reply) => {
      await prisma.channel.delete({ where: { id: req.params.channelId } })
      return reply.status(204).send()
    }
  )
}
