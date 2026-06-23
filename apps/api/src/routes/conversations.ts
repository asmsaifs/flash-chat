import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { PaginationQuerySchema } from '@flashchat/shared'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'
import { sendChannelMessage } from '../services/channel.service.js'
import { emitToWorkspace } from '../lib/socket.js'
import type { MessageContent } from '@flashchat/shared'

export async function conversationRoutes(app: FastifyInstance) {
  const preHandler = [authMiddleware, workspaceMiddleware]

  app.get<{ Params: { workspaceId: string }; Querystring: { page?: string; pageSize?: string; status?: string; search?: string } }>(
    '/workspaces/:workspaceId/conversations',
    { preHandler },
    async (req, reply) => {
      const { page, pageSize, search, status } = req.query
      const p = PaginationQuerySchema.parse({ page, pageSize, search })
      const skip = (p.page - 1) * p.pageSize

      const where = {
        workspaceId: req.workspaceId,
        ...(status ? { status: status as 'open' | 'assigned' | 'resolved' | 'snoozed' } : {}),
      }

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          include: {
            contact: { include: { tags: true } },
            channel: true,
            assignedAgent: true,
            messages: { orderBy: { sentAt: 'desc' }, take: 1 },
          },
          skip,
          take: p.pageSize,
          orderBy: { lastMessageAt: 'desc' },
        }),
        prisma.conversation.count({ where }),
      ])

      const data = conversations.map(({ messages, ...c }) => ({ ...c, messages, lastMessage: messages[0] ?? null }))
      return reply.send({ data, meta: { total, page: p.page, pageSize: p.pageSize } })
    }
  )

  app.get<{ Params: { workspaceId: string; conversationId: string } }>(
    '/workspaces/:workspaceId/conversations/:conversationId',
    { preHandler },
    async (req, reply) => {
      const conversation = await prisma.conversation.findFirstOrThrow({
        where: { id: req.params.conversationId, workspaceId: req.workspaceId },
        include: {
          contact: { include: { tags: true } },
          channel: true,
          assignedAgent: true,
          messages: { orderBy: { sentAt: 'asc' }, take: 100 },
        },
      })

      // Mark as read
      await prisma.conversation.update({
        where: { id: req.params.conversationId },
        data: { unreadCount: 0 },
      })

      return reply.send({ data: conversation })
    }
  )

  // Send message from agent
  app.post<{ Params: { workspaceId: string; conversationId: string }; Body: { content: MessageContent } }>(
    '/workspaces/:workspaceId/conversations/:conversationId/messages',
    { preHandler },
    async (req, reply) => {
      const conversation = await prisma.conversation.findFirstOrThrow({
        where: { id: req.params.conversationId, workspaceId: req.workspaceId },
        include: { contact: true },
      })

      await sendChannelMessage(conversation.channelId, conversation.contact, req.body.content)

      const message = await prisma.message.create({
        data: {
          conversationId: req.params.conversationId,
          direction: 'outbound',
          content: req.body.content as object,
          status: 'sent',
          agentId: req.userId,
        },
      })

      await prisma.conversation.update({
        where: { id: req.params.conversationId },
        data: { lastMessageAt: new Date() },
      })

      emitToWorkspace(req.workspaceId, 'message:new', { conversationId: req.params.conversationId, message })

      return reply.status(201).send({ data: message })
    }
  )

  // Update conversation status
  app.patch<{ Params: { workspaceId: string; conversationId: string }; Body: { status?: string; assignedAgentId?: string | null } }>(
    '/workspaces/:workspaceId/conversations/:conversationId',
    { preHandler },
    async (req, reply) => {
      const conversation = await prisma.conversation.update({
        where: { id: req.params.conversationId },
        data: req.body as object,
      })
      emitToWorkspace(req.workspaceId, 'conversation:updated', { conversation })
      return reply.send({ data: conversation })
    }
  )
}
