import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Webhook } from 'svix'
import { prisma } from '@flashchat/database'

interface ClerkUserEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: {
    id: string
    email_addresses: Array<{ email_address: string; id: string }>
    primary_email_address_id: string
    first_name: string | null
    last_name: string | null
    image_url: string
  }
}

export async function clerkWebhookHandler(app: FastifyInstance) {
  app.post(
    '/webhooks/clerk',
    {},
    async (req: FastifyRequest, reply: FastifyReply) => {
      const secret = process.env.CLERK_WEBHOOK_SECRET
      if (!secret) {
        return reply.status(500).send({ error: 'CLERK_WEBHOOK_SECRET not configured' })
      }

      const svixId = req.headers['svix-id'] as string
      const svixTimestamp = req.headers['svix-timestamp'] as string
      const svixSignature = req.headers['svix-signature'] as string

      if (!svixId || !svixTimestamp || !svixSignature) {
        return reply.status(400).send({ error: 'Missing svix headers' })
      }

      const wh = new Webhook(secret)
      let event: ClerkUserEvent

      try {
        const body = JSON.stringify(req.body)
        event = wh.verify(body, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        }) as ClerkUserEvent
      } catch {
        return reply.status(400).send({ error: 'Invalid webhook signature' })
      }

      if (event.type === 'user.deleted') {
        await prisma.user.delete({ where: { id: event.data.id } }).catch(() => {})
        return reply.status(200).send({ received: true })
      }

      if (event.type === 'user.created' || event.type === 'user.updated') {
        const { id, email_addresses, primary_email_address_id, first_name, last_name, image_url } = event.data
        const primaryEmail = email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ?? email_addresses[0]?.email_address ?? ''
        const name = [first_name, last_name].filter(Boolean).join(' ') || primaryEmail

        await prisma.user.upsert({
          where: { id },
          create: { id, email: primaryEmail, name, avatarUrl: image_url || null },
          update: { email: primaryEmail, name, avatarUrl: image_url || null },
        })

        // Link any pending workspace invites for this email
        await prisma.workspaceMember.updateMany({
          where: { userId: `pending:${primaryEmail}` },
          data: { userId: id, acceptedAt: new Date() },
        })
      }

      return reply.status(200).send({ received: true })
    }
  )
}
