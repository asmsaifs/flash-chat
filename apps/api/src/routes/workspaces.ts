import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { CreateWorkspaceSchema, InviteMemberSchema, UpdateWorkspaceSettingsSchema } from '@flashchat/shared'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'
import { clerk } from '../lib/clerk.js'


export async function workspaceRoutes(app: FastifyInstance) {
  // List user's workspaces
  app.get('/workspaces', { preHandler: [authMiddleware] }, async (req, reply) => {
    const members = await prisma.workspaceMember.findMany({
      where: { userId: req.userId },
      include: { workspace: true },
    })
    return reply.send({ data: members.map((m) => ({ ...m.workspace, role: m.role })) })
  })

  // Create workspace
  app.post('/workspaces', { preHandler: [authMiddleware] }, async (req, reply) => {
    const body = CreateWorkspaceSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Validation', message: body.error.message, statusCode: 400 })

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } })

    const workspace = await prisma.workspace.create({
      data: {
        ...body.data,
        members: {
          create: {
            userId: req.userId,
            role: 'owner',
            email: dbUser.email,
            name: dbUser.name,
            avatarUrl: dbUser.avatarUrl,
          },
        },
        subscription: {
          create: {
            stripeCustomerId: '',
            plan: 'free',
            status: 'active',
          },
        },
      },
    })

    return reply.status(201).send({ data: workspace })
  })

  // Get workspace
  app.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId',
    { preHandler: [authMiddleware, workspaceMiddleware] },
    async (req, reply) => {
      const workspace = await prisma.workspace.findUniqueOrThrow({
        where: { id: req.workspaceId },
        include: { subscription: true },
      })
      return reply.send({ data: workspace })
    }
  )

  // Update workspace settings
  app.patch<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId',
    { preHandler: [authMiddleware, workspaceMiddleware] },
    async (req, reply) => {
      const body = UpdateWorkspaceSettingsSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Validation', message: body.error.message, statusCode: 400 })
      const workspace = await prisma.workspace.update({
        where: { id: req.workspaceId },
        data: body.data,
      })
      return reply.send({ data: workspace })
    }
  )

  // List members
  app.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/members',
    { preHandler: [authMiddleware, workspaceMiddleware] },
    async (req, reply) => {
      const members = await prisma.workspaceMember.findMany({ where: { workspaceId: req.workspaceId } })
      return reply.send({ data: members })
    }
  )

  // Invite member
  app.post<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/members/invite',
    { preHandler: [authMiddleware, workspaceMiddleware] },
    async (req, reply) => {
      const body = InviteMemberSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Validation', message: body.error.message, statusCode: 400 })

      await clerk.invitations.createInvitation({
        emailAddress: body.data.email,
        redirectUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/sign-up`,
        ignoreExisting: true,
      }).catch((err: unknown) => {
        console.error('[invite] Clerk invitation failed:', err)
      })

      const member = await prisma.workspaceMember.create({
        data: {
          workspaceId: req.workspaceId,
          userId: `pending:${body.data.email}`,
          role: body.data.role,
          email: body.data.email,
          name: body.data.email,
        },
      })
      return reply.status(201).send({ data: member })
    }
  )

  // Remove member
  app.delete<{ Params: { workspaceId: string; memberId: string } }>(
    '/workspaces/:workspaceId/members/:memberId',
    { preHandler: [authMiddleware, workspaceMiddleware] },
    async (req, reply) => {
      await prisma.workspaceMember.delete({ where: { id: req.params.memberId } })
      return reply.status(204).send()
    }
  )
}
