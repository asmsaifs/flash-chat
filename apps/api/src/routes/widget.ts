import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { redis } from '../lib/redis.js'
import { randomUUID } from 'crypto'
import { emitToWorkspace, emitToWidgetConversation } from '../lib/socket.js'
import { startFlowExecution, resumeFlowExecution } from '../services/flow-engine.service.js'
import { generateAiReply } from '../services/ai.service.js'

async function verifyVisitorToken(token: string, conversationId: string): Promise<boolean> {
  const stored = await redis.get(`widget:token:${token}`)
  return stored === conversationId
}

async function generateWidgetAiReply(workspaceId: string, conversationId: string, userMessage: string) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })

  const recentMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { sentAt: 'asc' },
    take: 12,
  })

  const history = recentMessages
    .map((m) => (m.content as { text?: string }).text ?? '')
    .filter(Boolean)

  const { reply } = await generateAiReply(workspaceId, workspace.aiModel, userMessage, history)

  const content = { type: 'text', text: reply }
  const msg = await prisma.message.create({
    data: { conversationId, direction: 'outbound', content: content as object, status: 'sent' },
  })
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })
  emitToWorkspace(workspaceId, 'message:new', { conversationId, message: msg })
  emitToWidgetConversation(conversationId, 'message:receive', { content })
}

export async function widgetRoutes(app: FastifyInstance) {
  // Get widget config (public — no auth)
  app.get<{ Params: { channelId: string } }>(
    '/widget/:channelId/config',
    async (req, reply) => {
      const channel = await prisma.channel.findFirst({
        where: { id: req.params.channelId, type: 'web_widget', isActive: true },
        select: { id: true, name: true, widgetConfig: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Not found' })
      return reply.send({ data: channel })
    }
  )

  // Init widget session — creates contact + conversation, returns visitorToken
  app.post<{
    Params: { channelId: string }
    Body: { visitorId?: string; firstName?: string; email?: string }
  }>(
    '/widget/:channelId/conversations',
    async (req, reply) => {
      const channel = await prisma.channel.findFirst({
        where: { id: req.params.channelId, type: 'web_widget', isActive: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Not found' })

      const externalId = req.body.visitorId ?? randomUUID()

      const contact = await prisma.contact.upsert({
        where: {
          workspaceId_externalId_channelType: {
            workspaceId: channel.workspaceId,
            externalId,
            channelType: 'web_widget',
          },
        },
        create: {
          workspaceId: channel.workspaceId,
          externalId,
          channelType: 'web_widget',
          firstName: req.body.firstName ?? 'Visitor',
          email: req.body.email ?? null,
        },
        update: {},
      })

      const conversation = await prisma.conversation.create({
        data: {
          workspaceId: channel.workspaceId,
          contactId: contact.id,
          channelId: channel.id,
          status: 'open',
        },
      })

      const visitorToken = randomUUID()
      // Token expires in 7 days
      await redis.set(`widget:token:${visitorToken}`, conversation.id, 'EX', 60 * 60 * 24 * 7)

      emitToWorkspace(channel.workspaceId, 'conversation:new', { conversationId: conversation.id })

      // Trigger the first published flow with an active first_message trigger for this channel.
      // Await so activeFlowExecutionId is set before the 201 response — prevents race where
      // the widget's doSend arrives before the flow sets activeFlowExecutionId.
      const flow = await prisma.flow.findFirst({
        where: {
          workspaceId: channel.workspaceId,
          isPublished: true,
          triggers: {
            some: {
              triggerType: 'first_message',
              isActive: true,
              OR: [{ channelType: null }, { channelType: 'web_widget' }],
            },
          },
        },
      })
      if (flow) {
        await startFlowExecution(flow.id, contact.id, conversation.id).catch(console.error)
      }

      return reply.status(201).send({ data: { conversationId: conversation.id, visitorToken, externalId } })
    }
  )

  // Send message (visitor → platform)
  app.post<{
    Params: { channelId: string; conversationId: string }
    Headers: { authorization?: string }
    Body: { text: string }
  }>(
    '/widget/:channelId/conversations/:conversationId/messages',
    async (req, reply) => {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (!token) return reply.status(401).send({ error: 'Unauthorized' })
      if (!(await verifyVisitorToken(token, req.params.conversationId))) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: req.params.conversationId },
      })

      const content = { type: 'text', text: req.body.text }
      const message = await prisma.message.create({
        data: {
          conversationId: req.params.conversationId,
          direction: 'inbound',
          content: content as object,
          status: 'delivered',
        },
      })

      await prisma.conversation.update({
        where: { id: req.params.conversationId },
        data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
      })

      emitToWorkspace(conversation.workspaceId, 'message:new', {
        conversationId: req.params.conversationId,
        message,
      })

      // Resume flow if waiting for input, otherwise fall back to AI reply
      if (conversation.activeFlowExecutionId) {
        resumeFlowExecution(conversation.activeFlowExecutionId, req.params.conversationId, req.body.text).catch(
          console.error
        )
      } else {
        // No active flow — generate AI reply in background
        generateWidgetAiReply(conversation.workspaceId, req.params.conversationId, req.body.text).catch(console.error)
      }

      return reply.status(201).send({ data: message })
    }
  )

  // Get messages (polling — returns all or messages after a given timestamp)
  app.get<{
    Params: { channelId: string; conversationId: string }
    Headers: { authorization?: string }
    Querystring: { after?: string }
  }>(
    '/widget/:channelId/conversations/:conversationId/messages',
    async (req, reply) => {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (!token) return reply.status(401).send({ error: 'Unauthorized' })
      if (!(await verifyVisitorToken(token, req.params.conversationId))) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId: req.params.conversationId,
          ...(req.query.after ? { sentAt: { gt: new Date(req.query.after) } } : {}),
        },
        orderBy: { sentAt: 'asc' },
        take: 100,
      })

      return reply.send({ data: messages })
    }
  )
}
