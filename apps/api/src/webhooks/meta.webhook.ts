import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { startFlowExecution, resumeFlowExecution } from '../services/flow-engine.service.js'
import { analyzeSentiment } from '../services/ai.service.js'
import { emitToWorkspace } from '../lib/socket.js'
import type { ChannelType } from '@flashchat/shared'
import type { Channel } from '@prisma/client'

type ChannelWithWorkspace = Channel & { workspace: { aiModel: string } }

async function processMetaEntries(channel: ChannelWithWorkspace, entries: MetaWebhookPayload['entry']) {
  const channelId = channel.id
  for (const entry of entries ?? []) {
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
}

export async function metaWebhookHandler(app: FastifyInstance) {
  type HubQuery = { 'hub.mode': string; 'hub.verify_token': string; 'hub.challenge': string }

  // ── App-level webhook (automated subscription via Graph API) ──────────────
  // Meta calls this single URL for all pages subscribed to the app.
  // Routing to the right channel is done by matching entry.id (page ID).

  app.get<{ Querystring: HubQuery }>('/webhook/meta', async (req, reply) => {
    const appVerifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === appVerifyToken) {
      return reply.send(req.query['hub.challenge'])
    }
    return reply.status(403).send()
  })

  app.post<{ Body: MetaWebhookPayload }>('/webhook/meta', async (req, reply) => {
    const payload = req.body
    for (const entry of payload.entry ?? []) {
      const pageId = entry.id
      const channel = await prisma.channel.findFirst({
        where: {
          type: { in: ['messenger', 'instagram'] },
          credentials: { path: ['pageId'], equals: pageId },
        },
        include: { workspace: true },
      }) as ChannelWithWorkspace | null
      if (!channel) continue
      await processMetaEntries(channel, [entry])
    }
    return reply.send({ ok: true })
  })

  // ── Per-channel webhook (legacy / manual setup fallback) ──────────────────

  app.get<{ Params: { channelId: string }; Querystring: HubQuery }>(
    '/webhook/meta/:channelId',
    async (req, reply) => {
      const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } })
      const creds = channel?.credentials as { verifyToken?: string } | null
      if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === creds?.verifyToken) {
        return reply.send(req.query['hub.challenge'])
      }
      return reply.status(403).send()
    }
  )

  app.post<{ Params: { channelId: string }; Body: MetaWebhookPayload }>(
    '/webhook/meta/:channelId',
    async (req, reply) => {
      const channel = await prisma.channel.findUnique({
        where: { id: req.params.channelId },
        include: { workspace: true },
      }) as ChannelWithWorkspace | null
      if (!channel) return reply.send({ ok: true })
      await processMetaEntries(channel, req.body.entry)
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
