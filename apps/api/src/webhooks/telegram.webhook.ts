import type { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '@flashchat/database'
import { startFlowExecution, resumeFlowExecution } from '../services/flow-engine.service.js'
import { analyzeSentiment } from '../services/ai.service.js'
import { emitToWorkspace } from '../lib/socket.js'

interface TelegramUpdate {
  update_id: number
  message?: { message_id: number; from: { id: number; first_name: string; last_name?: string; username?: string }; chat: { id: number }; text?: string; photo?: unknown[] }
  callback_query?: { id: string; from: { id: number; first_name: string }; data?: string; message?: { chat: { id: number } } }
}

export async function telegramWebhookHandler(app: FastifyInstance) {
  app.post<{ Params: { channelId: string }; Body: TelegramUpdate }>(
    '/webhook/telegram/:channelId',
    async (req, reply) => {
      const { channelId } = req.params
      const update = req.body

      const channel = await prisma.channel.findUnique({ where: { id: channelId }, include: { workspace: true } })
      if (!channel) return reply.status(404).send({ ok: false })

      const msg = update.message
      const cbq = update.callback_query

      if (!msg && !cbq) return reply.send({ ok: true })

      const from = msg?.from ?? cbq?.from
      const chatId = String(msg?.chat?.id ?? cbq?.message?.chat?.id)
      const text = msg?.text ?? cbq?.data ?? ''

      if (!from || !chatId) return reply.send({ ok: true })

      // Upsert contact
      const contact = await prisma.contact.upsert({
        where: { workspaceId_externalId_channelType: { workspaceId: channel.workspaceId, externalId: chatId, channelType: 'telegram' } },
        update: { lastSeenAt: new Date() },
        create: {
          workspaceId: channel.workspaceId,
          externalId: chatId,
          channelType: 'telegram',
          firstName: from.first_name,
          lastName: 'last_name' in from ? (from.last_name as string) : undefined,
        },
      })

      // Upsert conversation
      let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id, channelId, status: { not: 'resolved' } },
      })

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { workspaceId: channel.workspaceId, contactId: contact.id, channelId, status: 'open' },
        })
      }

      // Sentiment analysis
      const { sentiment } = await analyzeSentiment(text, channel.workspace.aiModel).catch(() => ({ sentiment: 'neutral' as const }))

      // Save inbound message
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'inbound',
          content: { type: 'text', text },
          status: 'delivered',
          sentiment,
        },
      })

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
      })

      emitToWorkspace(channel.workspaceId, 'message:new', { conversationId: conversation.id, message })

      // Flow execution
      if (conversation.activeFlowExecutionId) {
        await resumeFlowExecution(conversation.activeFlowExecutionId, conversation.id, text)
      } else {
        const trigger = await prisma.flowTrigger.findFirst({
          where: {
            flow: { workspaceId: channel.workspaceId, isPublished: true },
            channelType: 'telegram',
            OR: [{ triggerType: 'first_message', keyword: null }, { triggerType: 'keyword', keyword: text.toLowerCase().trim() }],
          },
          include: { flow: true },
        })

        if (trigger) {
          await startFlowExecution(trigger.flowId, contact.id, conversation.id)
        }
      }

      return reply.send({ ok: true })
    }
  )
}
