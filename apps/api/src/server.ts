import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { Server as SocketServer } from 'socket.io'
import { setSocketIo } from './lib/socket.js'
import { redis } from './lib/redis.js'

// Routes
import { workspaceRoutes } from './routes/workspaces.js'
import { channelRoutes } from './routes/channels.js'
import { contactRoutes } from './routes/contacts.js'
import { conversationRoutes } from './routes/conversations.js'
import { flowRoutes } from './routes/flows.js'
import { broadcastRoutes } from './routes/broadcasts.js'
import { knowledgeBaseRoutes } from './routes/knowledge-base.js'
import { analyticsRoutes } from './routes/analytics.js'
import { widgetRoutes } from './routes/widget.js'

// Webhooks
import { telegramWebhookHandler } from './webhooks/telegram.webhook.js'
import { metaWebhookHandler } from './webhooks/meta.webhook.js'
import { whatsappWebhookHandler } from './webhooks/whatsapp.webhook.js'
import { clerkWebhookHandler } from './webhooks/clerk.webhook.js'

// Workers
import { startBroadcastWorker } from './workers/broadcast.worker.js'

const PORT = Number(process.env.PORT ?? 4000)
const HOST = process.env.HOST ?? '0.0.0.0'

async function bootstrap() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'production' })

  // Attach Socket.io to Fastify's underlying HTTP server
  const io = new SocketServer(app.server, {
    cors: { origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true },
  })
  setSocketIo(io)

  // Socket.io authentication + rooms
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined
    const workspaceId = socket.handshake.auth.workspaceId as string | undefined

    if (!token || !workspaceId) return next(new Error('Unauthorized'))

    socket.data.workspaceId = workspaceId
    next()
  })

  io.on('connection', (socket) => {
    const { workspaceId } = socket.data as { workspaceId: string }
    socket.join(`workspace:${workspaceId}`)

    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`)
    })

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`)
    })

    socket.on('typing:start', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', { userId: socket.id })
    })

    socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', { userId: socket.id })
    })
  })

  // Security & CORS — echo origin so widget embeds on any third-party site work
  await app.register(cors, {
    origin: (origin, cb) => cb(null, origin ?? '*'),
    credentials: true,
  })
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    redis,
  })

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // API routes
  await app.register(workspaceRoutes)
  await app.register(channelRoutes)
  await app.register(contactRoutes)
  await app.register(conversationRoutes)
  await app.register(flowRoutes)
  await app.register(broadcastRoutes)
  await app.register(knowledgeBaseRoutes)
  await app.register(analyticsRoutes)

  // Widget routes (public — no auth middleware, auth via visitor token in Redis)
  await app.register(widgetRoutes)

  // Webhook routes (no auth middleware — verified by channel/svix secret)
  await app.register(telegramWebhookHandler)
  await app.register(metaWebhookHandler)
  await app.register(whatsappWebhookHandler)
  await app.register(clerkWebhookHandler)

  // Start workers
  startBroadcastWorker()

  await app.listen({ port: PORT, host: HOST })
  console.log(`[API] running at http://${HOST}:${PORT}`)
}

bootstrap().catch((err) => {
  console.error('[API] fatal error:', err)
  process.exit(1)
})
