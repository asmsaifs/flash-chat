import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { startFlowExecution, resumeFlowExecution } from '../services/flow-engine.service.js'
import { analyzeSentiment } from '../services/ai.service.js'
import { emitToWorkspace } from '../lib/socket.js'

export async function whatsappWebhookHandler(app: FastifyInstance) {
  // Verification
  app.get<{ Params: { channelId: string }; Querystring: { 'hub.mode': string; 'hub.verify_token': string; 'hub.challenge': string } }>(
    '/webhook/whatsapp/:channelId',
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

  app.post<{ Params: { channelId: string }; Body: WhatsAppWebhookPayload }>(
    '/webhook/whatsapp/:channelId',
    async (req, reply) => {
      const { channelId } = req.params
      const payload = req.body

      const channel = await prisma.channel.findUnique({ where: { id: channelId }, include: { workspace: true } })
      if (!channel) return reply.send({ ok: true })

      const changes = payload.entry?.[0]?.changes?.[0]?.value
      if (!changes) return reply.send({ ok: true })

      for (const waMsg of changes.messages ?? []) {
        const from = waMsg.from
        const text = waMsg.text?.body ?? waMsg.interactive?.button_reply?.title ?? waMsg.interactive?.list_reply?.title ?? ''

        if (!text) continue

        const contact = await prisma.contact.upsert({
          where: { workspaceId_externalId_channelType: { workspaceId: channel.workspaceId, externalId: from, channelType: 'whatsapp' } },
          update: { lastSeenAt: new Date(), phone: `+${from}` },
          create: { workspaceId: channel.workspaceId, externalId: from, channelType: 'whatsapp', phone: `+${from}` },
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
            externalId: waMsg.id,
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
                { channelType: 'whatsapp', triggerType: 'first_message' },
                { channelType: 'whatsapp', triggerType: 'keyword', keyword: text.toLowerCase().trim() },
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

      return reply.send({ ok: true })
    }
  )
}

interface WhatsAppWebhookPayload {
  entry: Array<{
    changes: Array<{
      value: {
        messages?: Array<{
          id: string
          from: string
          type: string
          text?: { body: string }
          interactive?: {
            type: string
            button_reply?: { id: string; title: string }
            list_reply?: { id: string; title: string }
          }
        }>
        statuses?: Array<{ id: string; status: string; timestamp: string; recipient_id: string }>
      }
    }>
  }>
}
