import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from '@clerk/backend'
import { createClerkClient } from '@clerk/backend'
import { prisma } from '@flashchat/database'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    workspaceId: string
    memberRole: string
  }
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

// Tracks users synced this server process — avoids a DB lookup on every request
const syncedUsers = new Set<string>()

async function ensureUserInDb(userId: string) {
  if (syncedUsers.has(userId)) return
  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) {
    const clerkUser = await clerk.users.getUser(userId)
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
    const name = `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || email
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email, name, avatarUrl: clerkUser.imageUrl || null },
      update: { email, name, avatarUrl: clerkUser.imageUrl || null },
    })
  }
  syncedUsers.add(userId)
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Missing token', statusCode: 401 })
  }

  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    req.userId = payload.sub
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token', statusCode: 401 })
  }

  await ensureUserInDb(req.userId).catch((err: unknown) => {
    console.error('[auth] user sync failed for', req.userId, err)
  })
}

export async function workspaceMiddleware(req: FastifyRequest<{ Params: { workspaceId?: string } }>, reply: FastifyReply) {
  const workspaceId = req.params.workspaceId ?? (req.headers['x-workspace-id'] as string)

  if (!workspaceId) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Missing workspace ID', statusCode: 400 })
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: req.userId },
  })

  if (!member) {
    return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this workspace', statusCode: 403 })
  }

  req.workspaceId = workspaceId
  req.memberRole = member.role
}
