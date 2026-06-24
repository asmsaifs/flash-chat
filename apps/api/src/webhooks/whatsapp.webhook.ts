import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { startFlowExecution, resumeFlowExecution } from '../services/flow-engine.service.js'
import { analyzeSentiment } from '../services/ai.service.js'
import { emitToWorkspace } from '../lib/socket.js'
import type { Channel } from '@prisma/client'

type ChannelWithWorkspace = Channel & { workspace: { aiModel: string } }

type ChangeValue = {
  metadata?: { phone_number_id: string }
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
  contacts?: Array<{ profile: { name: string }; wa_id: string }>
  statuses?: Array<{ id: string; status: string; timestamp: string; recipient_id: string }>
}

async function processWhatsAppChange(channel: ChannelWithWorkspace, changes: ChangeValue, channelId: string) {
  for (const waMsg of changes.messages ?? []) {
    const from = waMsg.from
    const text = waMsg.text?.body ?? waMsg.interactive?.button_reply?.title ?? waMsg.interactive?.list_reply?.title ?? ''

    if (!text) continue

    const profileName = changes.contacts?.find(c => c.wa_id === from)?.profile.name
    const [firstName, ...rest] = profileName ? profileName.split(' ') : []
    const lastName = rest.length > 0 ? rest.join(' ') : undefined

    const contact = await prisma.contact.upsert({
      where: { workspaceId_externalId_channelType: { workspaceId: channel.workspaceId, externalId: from, channelType: 'whatsapp' } },
      update: { lastSeenAt: new Date(), phone: `+${from}`, ...(firstName && { firstName }), ...(lastName && { lastName }) },
      create: { workspaceId: channel.workspaceId, externalId: from, channelType: 'whatsapp', phone: `+${from}`, firstName, lastName },
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
}

export async function whatsappWebhookHandler(app: FastifyInstance) {
  type HubQuery = { 'hub.mode': string; 'hub.verify_token': string; 'hub.challenge': string }

  // ── App-level webhook (automated subscription) ────────────────────────────
  // Routes by phoneNumberId found in payload metadata.

  app.get<{ Querystring: HubQuery }>('/webhook/whatsapp', async (req, reply) => {
    const appVerifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === appVerifyToken) {
      return reply.send(req.query['hub.challenge'])
    }
    return reply.status(403).send()
  })

  app.post<{ Body: WhatsAppWebhookPayload }>('/webhook/whatsapp', async (req, reply) => {
    for (const entry of req.body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id
        if (!phoneNumberId) continue
        const channel = await prisma.channel.findFirst({
          where: {
            type: 'whatsapp',
            credentials: { path: ['phoneNumberId'], equals: phoneNumberId },
          },
          include: { workspace: true },
        }) as ChannelWithWorkspace | null
        if (!channel) continue
        await processWhatsAppChange(channel, change.value, channel.id)
      }
    }
    return reply.send({ ok: true })
  })

  // ── Per-channel webhook (legacy / manual setup fallback) ──────────────────

  app.get<{ Params: { channelId: string }; Querystring: HubQuery }>(
    '/webhook/whatsapp/:channelId',
    async (req, reply) => {
      const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } })
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
      const channel = await prisma.channel.findUnique({ where: { id: channelId }, include: { workspace: true } }) as ChannelWithWorkspace | null
      if (!channel) return reply.send({ ok: true })

      const changes = req.body.entry?.[0]?.changes?.[0]?.value
      if (!changes) return reply.send({ ok: true })

      await processWhatsAppChange(channel, changes, channelId)
      return reply.send({ ok: true })
    }
  )
}

interface WhatsAppWebhookPayload {
  entry: Array<{
    changes: Array<{
      value: ChangeValue
    }>
  }>
}
