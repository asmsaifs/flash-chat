import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { startFlowExecution, resumeFlowExecution } from '../services/flow-engine.service.js'
import { analyzeSentiment } from '../services/ai.service.js'
import { emitToWorkspace } from '../lib/socket.js'
import type { ChannelType } from '@flashchat/shared'

export async function metaWebhookHandler(app: FastifyInstance) {
  // Webhook verification
  app.get<{ Params: { channelId: string }; Querystring: { 'hub.mode': string; 'hub.verify_token': string; 'hub.challenge': string } }>(
    '/webhook/meta/:channelId',
    async (req, reply) => {
      const { channelId } = req.params
      const channel = await prisma.channel.findUnique({ where: { id: channelId } })
      const creds = channel?.credentials as { verifyToken?: string } | null

      if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === creds?.verifyToken) {
        return reply.send(req.query['hub.challenge'])
      }
      return reply.status(403).send()
    }
  )

  // Receive messages
  app.post<{ Params: { channelId: string }; Body: MetaWebhookPayload }>(
    '/webhook/meta/:channelId',
    async (req, reply) => {
      const { channelId } = req.params
      const payload = req.body

      const channel = await prisma.channel.findUnique({ where: { id: channelId }, include: { workspace: true } })
      if (!channel) return reply.send({ ok: true })

      for (const entry of payload.entry ?? []) {
        for (const messaging of entry.messaging ?? []) {
          const senderId = messaging.sender.id
          const text = messaging.message?.text ?? messaging.postback?.payload ?? ''

          if (!text) continue

          const contact = await prisma.contact.upsert({
            where: { workspaceId_externalId_channelType: { workspaceId: channel.workspaceId, externalId: senderId, channelType: channel.type as ChannelType } },
            update: { lastSeenAt: new Date() },
            create: { workspaceId: channel.workspaceId, externalId: senderId, channelType: channel.type as ChannelType },
          })

          let conversation = await prisma.conversation.findFirst({
            where: { contactId: contact.id, channelId, status: { not: 'resolved' } },
          })

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: { workspaceId: channel.workspaceId, contactId: contact.id, channelId, status: 'open' },
            })
          }

          const { sentiment } = await analyzeSentiment(text, channel.workspace.aiModel).catch(() => ({ sentiment: 'neutral' as const }))

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

          if (conversation.activeFlowExecutionId) {
            await resumeFlowExecution(conversation.activeFlowExecutionId, conversation.id, text)
          } else {
            const trigger = await prisma.flowTrigger.findFirst({
              where: {
                flow: { workspaceId: channel.workspaceId, isPublished: true },
                OR: [
                  { channelType: channel.type as ChannelType, triggerType: 'first_message' },
                  { channelType: channel.type as ChannelType, triggerType: 'keyword', keyword: text.toLowerCase().trim() },
                  { channelType: null, triggerType: 'first_message' },
                  { channelType: null, triggerType: 'keyword', keyword: text.toLowerCase().trim() },
                ],
              },
            })
            if (trigger) {
              await startFlowExecution(trigger.flowId, contact.id, conversation.id)
            }
          }
        }
      }

      return reply.send({ ok: true })
    }
  )
}

interface MetaWebhookPayload {
  object: string
  entry: Array<{
    id: string
    messaging: Array<{
      sender: { id: string }
      recipient: { id: string }
      timestamp: number
      message?: { mid: string; text?: string }
      postback?: { payload: string; title: string }
    }>
  }>
}
