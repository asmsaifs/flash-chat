import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { createHash, randomBytes } from 'crypto'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function apiKeyRoutes(app: FastifyInstance) {
  const preHandler = [authMiddleware, workspaceMiddleware]

  // List API keys (never expose hash)
  app.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/api-keys',
    { preHandler },
    async (req, reply) => {
      const keys = await prisma.apiKey.findMany({
        where: { workspaceId: req.workspaceId },
        select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send({ data: keys })
    }
  )

  // Create API key — key returned once, only prefix + hash stored
  app.post<{ Params: { workspaceId: string }; Body: { name: string } }>(
    '/workspaces/:workspaceId/api-keys',
    { preHandler },
    async (req, reply) => {
      const raw = `fc_${randomBytes(32).toString('hex')}`
      const prefix = raw.slice(0, 10)
      const keyRecord = await prisma.apiKey.create({
        data: {
          workspaceId: req.workspaceId,
          name: req.body.name ?? 'API Key',
          keyHash: hashKey(raw),
          keyPrefix: prefix,
        },
      })
      return reply.status(201).send({ data: { id: keyRecord.id, name: keyRecord.name, keyPrefix: prefix, key: raw } })
    }
  )

  // Revoke API key
  app.delete<{ Params: { workspaceId: string; keyId: string } }>(
    '/workspaces/:workspaceId/api-keys/:keyId',
    { preHandler },
    async (req, reply) => {
      await prisma.apiKey.delete({ where: { id: req.params.keyId } })
      return reply.status(204).send()
    }
  )
}

// Validates an API key from Authorization header — used by external integrations
export async function validateApiKey(rawKey: string): Promise<{ workspaceId: string } | null> {
  const hash = hashKey(rawKey)
  const record = await prisma.apiKey.findUnique({ where: { keyHash: hash } })
  if (!record) return null
  await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
  return { workspaceId: record.workspaceId }
}
