import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { CreateContactSchema, PaginationQuerySchema } from '@flashchat/shared'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'

export async function contactRoutes(app: FastifyInstance) {
  const preHandler = [authMiddleware, workspaceMiddleware]

  app.get<{ Params: { workspaceId: string }; Querystring: { page?: string; pageSize?: string; search?: string; tag?: string } }>(
    '/workspaces/:workspaceId/contacts',
    { preHandler },
    async (req, reply) => {
      const { page, pageSize, search, tag } = req.query
      const p = PaginationQuerySchema.parse({ page, pageSize, search })
      const skip = (p.page - 1) * p.pageSize

      const where = {
        workspaceId: req.workspaceId,
        ...(p.search ? {
          OR: [
            { firstName: { contains: p.search, mode: 'insensitive' as const } },
            { lastName: { contains: p.search, mode: 'insensitive' as const } },
            { email: { contains: p.search, mode: 'insensitive' as const } },
            { phone: { contains: p.search } },
          ],
        } : {}),
        ...(tag ? { tags: { some: { tag } } } : {}),
      }

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          include: { tags: true },
          skip,
          take: p.pageSize,
          orderBy: { subscribedAt: 'desc' },
        }),
        prisma.contact.count({ where }),
      ])

      return reply.send({ data: contacts, meta: { total, page: p.page, pageSize: p.pageSize } })
    }
  )

  app.get<{ Params: { workspaceId: string; contactId: string } }>(
    '/workspaces/:workspaceId/contacts/:contactId',
    { preHandler },
    async (req, reply) => {
      const contact = await prisma.contact.findFirstOrThrow({
        where: { id: req.params.contactId, workspaceId: req.workspaceId },
        include: {
          tags: true,
          conversations: { include: { channel: true }, orderBy: { lastMessageAt: 'desc' }, take: 5 },
        },
      })
      return reply.send({ data: contact })
    }
  )

  app.post<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/contacts',
    { preHandler },
    async (req, reply) => {
      const body = CreateContactSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Validation', message: body.error.message, statusCode: 400 })

      const { tags, ...rest } = body.data
      const contact = await prisma.contact.create({
        data: {
          workspaceId: req.workspaceId,
          ...rest,
          customFields: (rest.customFields ?? {}) as never,
          tags: { create: tags.map((tag) => ({ tag })) },
        },
        include: { tags: true },
      })
      return reply.status(201).send({ data: contact })
    }
  )

  app.patch<{ Params: { workspaceId: string; contactId: string } }>(
    '/workspaces/:workspaceId/contacts/:contactId',
    { preHandler },
    async (req, reply) => {
      const contact = await prisma.contact.update({
        where: { id: req.params.contactId },
        data: req.body as object,
        include: { tags: true },
      })
      return reply.send({ data: contact })
    }
  )

  // Add tag
  app.post<{ Params: { workspaceId: string; contactId: string }; Body: { tag: string } }>(
    '/workspaces/:workspaceId/contacts/:contactId/tags',
    { preHandler },
    async (req, reply) => {
      await prisma.contactTag.upsert({
        where: { contactId_tag: { contactId: req.params.contactId, tag: req.body.tag } },
        update: {},
        create: { contactId: req.params.contactId, tag: req.body.tag },
      })
      return reply.status(201).send({ data: { tag: req.body.tag } })
    }
  )

  // Remove tag
  app.delete<{ Params: { workspaceId: string; contactId: string; tag: string } }>(
    '/workspaces/:workspaceId/contacts/:contactId/tags/:tag',
    { preHandler },
    async (req, reply) => {
      await prisma.contactTag.deleteMany({
        where: { contactId: req.params.contactId, tag: req.params.tag },
      })
      return reply.status(204).send()
    }
  )

  // Get contact activity
  app.get<{ Params: { workspaceId: string; contactId: string } }>(
    '/workspaces/:workspaceId/contacts/:contactId/activity',
    { preHandler },
    async (req, reply) => {
      const messages = await prisma.message.findMany({
        where: { conversation: { contactId: req.params.contactId, workspaceId: req.workspaceId } },
        orderBy: { sentAt: 'desc' },
        take: 50,
        include: { conversation: { include: { channel: true } } },
      })
      return reply.send({ data: messages })
    }
  )
}
