import { Worker } from 'bullmq'
import { prisma } from '@flashchat/database'
import { sendChannelMessage } from '../services/channel.service.js'
import { redis } from '../lib/redis.js'

export function startBroadcastWorker() {
  const worker = new Worker(
    'broadcast',
    async (job) => {
      const { broadcastId, contactId, workspaceId } = job.data as {
        broadcastId: string
        contactId: string
        workspaceId: string
      }

      const [broadcast, contact] = await Promise.all([
        prisma.broadcast.findUniqueOrThrow({ where: { id: broadcastId }, include: { channels: { include: { channel: true } } } }),
        prisma.contact.findUniqueOrThrow({ where: { id: contactId } }),
      ])

      let status: 'sent' | 'failed' = 'sent'

      try {
        for (const bc of broadcast.channels) {
          await sendChannelMessage(bc.channelId, contact, broadcast.content as never)
        }

        await prisma.broadcastRecipient.create({
          data: { broadcastId, contactId, status: 'sent', sentAt: new Date() },
        })

        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: { statsSent: { increment: 1 } },
        })
      } catch (err) {
        status = 'failed'
        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: { statsFailed: { increment: 1 } },
        })
        throw err
      }

      // Check if all done
      const bc = await prisma.broadcast.findUnique({ where: { id: broadcastId } })
      if (bc && bc.statsSent + bc.statsFailed >= bc.statsTotal) {
        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: { status: 'sent', sentAt: new Date() },
        })
      }

      return { status, contactId }
    },
    {
      connection: redis as never,
      concurrency: 10,
      limiter: { max: 50, duration: 1000 },
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`[BroadcastWorker] Job ${job?.id} failed:`, err.message)
  })

  console.log('[BroadcastWorker] started')
  return worker
}
