import type { FastifyInstance } from 'fastify'
import type Stripe from 'stripe'
import { prisma } from '@flashchat/database'
import { stripe } from '../lib/stripe.js'
import type { PlanName } from '@flashchat/shared'

// Maps Stripe product/price metadata plan name to our PlanName enum
function extractPlan(sub: Stripe.Subscription): PlanName {
  const meta = sub.metadata?.plan as PlanName | undefined
  if (meta && ['pro', 'business', 'agency'].includes(meta)) return meta
  // Fall back to matching price IDs via env vars
  const priceId = sub.items.data[0]?.price.id
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_BUSINESS_MONTHLY) return 'business'
  if (priceId === process.env.STRIPE_PRICE_AGENCY_MONTHLY) return 'agency'
  return 'free'
}

async function syncSubscription(sub: Stripe.Subscription) {
  const workspaceId = sub.metadata?.workspaceId
  if (!workspaceId) return

  const plan = extractPlan(sub)
  const status = sub.status === 'active' || sub.status === 'trialing' ? 'active'
    : sub.status === 'past_due' ? 'past_due'
    : sub.status === 'canceled' ? 'canceled'
    : 'active'

  await prisma.subscription.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      stripeCustomerId: sub.customer as string,
      stripeSubscriptionId: sub.id,
      plan,
      status,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    update: {
      stripeSubscriptionId: sub.id,
      plan,
      status,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  })
}

export async function stripeWebhookHandler(app: FastifyInstance) {
  // Parse body as raw Buffer for Stripe signature verification
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body)
  })

  app.post('/webhook/stripe', async (req, reply) => {
    const sig = req.headers['stripe-signature'] as string
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) return reply.status(500).send({ error: 'STRIPE_WEBHOOK_SECRET not set' })

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid signature'
      return reply.status(400).send({ error: msg })
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscription(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const workspaceId = sub.metadata?.workspaceId
        if (workspaceId) {
          await prisma.subscription.update({
            where: { workspaceId },
            data: { plan: 'free', status: 'canceled', stripeSubscriptionId: null },
          })
        }
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const fullSub = await stripe.subscriptions.retrieve(session.subscription as string)
          // Attach workspaceId metadata to subscription if missing
          if (!fullSub.metadata?.workspaceId && session.metadata?.workspaceId) {
            await stripe.subscriptions.update(fullSub.id, {
              metadata: { workspaceId: session.metadata.workspaceId },
            })
            fullSub.metadata = { workspaceId: session.metadata.workspaceId }
          }
          await syncSubscription(fullSub)
        }
        break
      }
    }

    return reply.send({ received: true })
  })
}
