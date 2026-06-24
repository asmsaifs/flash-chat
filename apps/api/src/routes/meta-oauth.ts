import type { FastifyInstance } from 'fastify'
import axios from 'axios'
import { z } from 'zod'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'
import { redis } from '../lib/redis.js'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'
const APP_ID = process.env.FACEBOOK_APP_ID!
const APP_SECRET = process.env.FACEBOOK_APP_SECRET!

interface PageOption {
  id: string
  name: string
  accessToken: string
}

interface PhoneOption {
  phoneNumberId: string
  displayNumber: string
  verifiedName: string
  accessToken: string
  wabaId: string
}

const ExchangeBody = z.object({
  shortLivedToken: z.string().min(1),
  channelType: z.enum(['messenger', 'whatsapp', 'instagram']),
})

async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  const { data } = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  })
  return data.access_token as string
}

async function fetchPages(longLivedToken: string): Promise<PageOption[]> {
  const { data } = await axios.get(`${GRAPH_BASE}/me/accounts`, {
    params: { fields: 'id,name,access_token', access_token: longLivedToken },
  })
  return (data.data as Array<{ id: string; name: string; access_token: string }>).map((p) => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
  }))
}

async function fetchInstagramPages(longLivedToken: string): Promise<PageOption[]> {
  const { data } = await axios.get(`${GRAPH_BASE}/me/accounts`, {
    params: {
      fields: 'id,name,access_token,instagram_business_account{id,name,username}',
      access_token: longLivedToken,
    },
  })
  return (data.data as Array<{ id: string; name: string; access_token: string; instagram_business_account?: object }>)
    .filter((p) => !!p.instagram_business_account)
    .map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token }))
}

async function fetchWhatsAppPhones(longLivedToken: string): Promise<PhoneOption[]> {
  const { data: bizData } = await axios.get(`${GRAPH_BASE}/me/businesses`, {
    params: { fields: 'id,name', access_token: longLivedToken },
  })

  const businesses = (bizData.data as Array<{ id: string; name: string }>).slice(0, 10)

  const phoneArrays = await Promise.all(
    businesses.map(async (biz) => {
      try {
        const { data: wabaData } = await axios.get(
          `${GRAPH_BASE}/${biz.id}/owned_whatsapp_business_accounts`,
          {
            params: {
              fields: 'id,name,phone_numbers{id,display_phone_number,verified_name}',
              access_token: longLivedToken,
            },
          }
        )
        return (wabaData.data as Array<{ id: string; phone_numbers?: { data: Array<{ id: string; display_phone_number: string; verified_name: string }> } }>).flatMap(
          (waba) =>
            (waba.phone_numbers?.data ?? []).map((ph) => ({
              phoneNumberId: ph.id,
              displayNumber: ph.display_phone_number,
              verifiedName: ph.verified_name,
              accessToken: longLivedToken,
              wabaId: waba.id,
            }))
        )
      } catch {
        return []
      }
    })
  )

  return phoneArrays.flat()
}

export async function metaOAuthRoutes(app: FastifyInstance) {
  const preHandler = [authMiddleware, workspaceMiddleware]

  app.post<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/meta/oauth/exchange',
    { preHandler },
    async (req, reply) => {
      const parsed = ExchangeBody.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation', message: parsed.error.message })
      }

      const { shortLivedToken, channelType } = parsed.data

      let longLivedToken: string
      try {
        longLivedToken = await exchangeForLongLivedToken(shortLivedToken)
      } catch (err) {
        const msg = axios.isAxiosError(err) ? (err.response?.data?.error?.message ?? err.message) : 'Token exchange failed'
        return reply.status(502).send({ error: 'MetaOAuthError', message: msg })
      }

      try {
        const verifyToken = crypto.randomUUID()
        await redis.set(`meta:oauth:vt:${req.workspaceId}`, verifyToken, 'EX', 600)

        if (channelType === 'messenger') {
          const pages = await fetchPages(longLivedToken)
          return reply.send({ pages, verifyToken })
        }

        if (channelType === 'instagram') {
          const pages = await fetchInstagramPages(longLivedToken)
          return reply.send({ pages, verifyToken })
        }

        // whatsapp
        // NOTE: For production, Meta recommends system user tokens instead of long-lived user tokens.
        // Long-lived user tokens with whatsapp_business_management scope work for MVP/development.
        const phones = await fetchWhatsAppPhones(longLivedToken)
        return reply.send({ phones, verifyToken })
      } catch (err) {
        const msg = axios.isAxiosError(err) ? (err.response?.data?.error?.message ?? err.message) : 'Failed to fetch account data'
        return reply.status(502).send({ error: 'MetaOAuthError', message: msg })
      }
    }
  )
}
