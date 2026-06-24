import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { stripe } from '../lib/stripe.js'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'
import { getUsageSummary } from '../middleware/plan-limits.js'

const PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO_MONTHLY,
  business: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
  agency: process.env.STRIPE_PRICE_AGENCY_MONTHLY,
}

export async function billingRoutes(app: FastifyInstance) {
  const preHandler = [authMiddleware, workspaceMiddleware]

  // Get current subscription + usage summary
  app.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/billing',
    { preHandler },
    async (req, reply) => {
      const [sub, usage] = await Promise.all([
        prisma.subscription.findUnique({ where: { workspaceId: req.workspaceId } }),
        getUsageSummary(req.workspaceId),
      ])
      return reply.send({ data: { subscription: sub, usage } })
    }
  )

  // Create Stripe Checkout session (upgrade / new subscription)
  app.post<{ Params: { workspaceId: string }; Body: { plan: string; returnUrl: string } }>(
    '/workspaces/:workspaceId/billing/checkout',
    { preHandler },
    async (req, reply) => {
      const { plan, returnUrl } = req.body
      const priceId = PRICE_IDS[plan]
      if (!priceId) return reply.status(400).send({ error: 'Invalid plan or price not configured', statusCode: 400 })

      let sub = await prisma.subscription.findUnique({ where: { workspaceId: req.workspaceId } })

      // Ensure Stripe customer exists
      if (!sub?.stripeCustomerId || sub.stripeCustomerId === '') {
        const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: req.workspaceId } })
        const customer = await stripe.customers.create({ name: workspace.name, metadata: { workspaceId: req.workspaceId } })
        sub = await prisma.subscription.upsert({
          where: { workspaceId: req.workspaceId },
          create: { workspaceId: req.workspaceId, stripeCustomerId: customer.id, plan: 'free', status: 'active' },
          update: { stripeCustomerId: customer.id },
        })
      }

      const session = await stripe.checkout.sessions.create({
        customer: sub.stripeCustomerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${returnUrl}?billing=success`,
        cancel_url: `${returnUrl}?billing=canceled`,
        metadata: { workspaceId: req.workspaceId },
        subscription_data: { metadata: { workspaceId: req.workspaceId } },
      })

      return reply.send({ data: { url: session.url } })
    }
  )

  // Create Stripe Customer Portal session (manage / cancel)
  app.post<{ Params: { workspaceId: string }; Body: { returnUrl: string } }>(
    '/workspaces/:workspaceId/billing/portal',
    { preHandler },
    async (req, reply) => {
      const sub = await prisma.subscription.findUnique({ where: { workspaceId: req.workspaceId } })
      if (!sub?.stripeCustomerId) {
        return reply.status(400).send({ error: 'No Stripe customer found. Subscribe first.', statusCode: 400 })
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: req.body.returnUrl,
      })

      return reply.send({ data: { url: session.url } })
    }
  )
}
