import type { FastifyInstance } from 'fastify'
import axios from 'axios'
import { prisma } from '@flashchat/database'
import { CreateChannelSchema } from '@flashchat/shared'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'
const APP_ID = process.env.FACEBOOK_APP_ID!
const APP_SECRET = process.env.FACEBOOK_APP_SECRET!

const MESSENGER_FIELDS = 'messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads'
const INSTAGRAM_FIELDS = 'messages,messaging_postbacks'

async function subscribePageToWebhook(pageId: string, pageAccessToken: string, fields: string) {
  await axios.post(
    `${GRAPH_BASE}/${pageId}/subscribed_apps`,
    null,
    { params: { subscribed_fields: fields, access_token: pageAccessToken } }
  )
}

const WHATSAPP_FIELDS = 'messages'

async function subscribeWabaToApp(wabaId: string, userAccessToken: string) {
  await axios.post(
    `${GRAPH_BASE}/${wabaId}/subscribed_apps`,
    null,
    { params: { access_token: userAccessToken } }
  )
}

async function ensureAppSubscription(object: 'page' | 'whatsapp_business_account', webhookPath: string, fields: string) {
  const callbackUrl = `${process.env.API_URL}${webhookPath}`
  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN
  if (!process.env.API_URL || !verifyToken) return
  await axios.post(
    `${GRAPH_BASE}/${APP_ID}/subscriptions`,
    null,
    {
      params: {
        object,
        callback_url: callbackUrl,
        verify_token: verifyToken,
        fields,
        access_token: `${APP_ID}|${APP_SECRET}`,
      },
    }
  )
}


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

      const creds = body.data.credentials as Record<string, string>
      if (body.data.type === 'messenger' && creds.pageId && creds.pageAccessToken) {
        await Promise.all([
          subscribePageToWebhook(creds.pageId, creds.pageAccessToken, MESSENGER_FIELDS),
          ensureAppSubscription('page', '/webhook/meta', MESSENGER_FIELDS),
        ]).catch((err) => req.log.warn({ err }, 'Failed to configure messenger webhook'))
      } else if (body.data.type === 'instagram' && creds.pageId && creds.pageAccessToken) {
        await Promise.all([
          subscribePageToWebhook(creds.pageId, creds.pageAccessToken, INSTAGRAM_FIELDS),
          ensureAppSubscription('page', '/webhook/meta', INSTAGRAM_FIELDS),
        ]).catch((err) => req.log.warn({ err }, 'Failed to configure instagram webhook'))
      } else if (body.data.type === 'whatsapp' && creds.wabaId && creds.accessToken) {
        const subscriptionErrors: string[] = []
        await ensureAppSubscription('whatsapp_business_account', '/webhook/whatsapp', WHATSAPP_FIELDS)
          .catch((err) => {
            const msg = axios.isAxiosError(err) ? (err.response?.data?.error?.message ?? err.message) : String(err)
            subscriptionErrors.push(`App subscription: ${msg}`)
            req.log.warn({ err }, 'Failed app-level whatsapp subscription')
          })
        await subscribeWabaToApp(creds.wabaId, creds.accessToken)
          .catch((err) => {
            const msg = axios.isAxiosError(err) ? (err.response?.data?.error?.message ?? err.message) : String(err)
            subscriptionErrors.push(`WABA subscription: ${msg}`)
            req.log.warn({ err }, 'Failed WABA-level whatsapp subscription')
          })
        if (subscriptionErrors.length) {
          return reply.status(201).send({ data: channel, warnings: subscriptionErrors })
        }
      }

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
