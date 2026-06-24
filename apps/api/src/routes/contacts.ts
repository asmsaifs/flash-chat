import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { CreateContactSchema, PaginationQuerySchema } from '@flashchat/shared'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'
import { checkSubscriberLimit } from '../middleware/plan-limits.js'

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

      const limitCheck = await checkSubscriberLimit(req.workspaceId)
      if (!limitCheck.allowed) {
        return reply.status(402).send({ error: 'Plan limit reached', message: `Subscriber limit (${limitCheck.limit}) reached. Upgrade your plan.`, statusCode: 402 })
      }

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

  // List all unique tags for workspace
  app.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/contacts/tags',
    { preHandler },
    async (req, reply) => {
      const tags = await prisma.contactTag.findMany({
        where: { contact: { workspaceId: req.workspaceId } },
        select: { tag: true },
        distinct: ['tag'],
        orderBy: { tag: 'asc' },
      })
      return reply.send({ data: tags.map((t) => t.tag) })
    }
  )

  // Bulk CSV import
  app.post<{ Params: { workspaceId: string }; Body: { contacts: Array<{ firstName?: string; lastName?: string; email?: string; phone?: string; tags?: string[] }> } }>(
    '/workspaces/:workspaceId/contacts/import',
    { preHandler },
    async (req, reply) => {
      const rows = req.body.contacts ?? []
      let imported = 0
      let failed = 0

      for (const row of rows) {
        try {
          const existing = row.email
            ? await prisma.contact.findFirst({ where: { workspaceId: req.workspaceId, email: row.email } })
            : row.phone
              ? await prisma.contact.findFirst({ where: { workspaceId: req.workspaceId, phone: row.phone } })
              : null

          if (existing) {
            await prisma.contact.update({
              where: { id: existing.id },
              data: {
                firstName: row.firstName ?? existing.firstName ?? undefined,
                lastName: row.lastName ?? existing.lastName ?? undefined,
              },
            })
            if (row.tags?.length) {
              for (const tag of row.tags) {
                await prisma.contactTag.upsert({
                  where: { contactId_tag: { contactId: existing.id, tag } },
                  update: {},
                  create: { contactId: existing.id, tag },
                })
              }
            }
          } else {
            const contact = await prisma.contact.create({
              data: {
                workspaceId: req.workspaceId,
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                phone: row.phone,
                customFields: {},
              },
            })
            if (row.tags?.length) {
              await prisma.contactTag.createMany({
                data: row.tags.map((tag) => ({ contactId: contact.id, tag })),
                skipDuplicates: true,
              })
            }
          }
          imported++
        } catch {
          failed++
        }
      }

      return reply.send({ data: { imported, failed, total: rows.length } })
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
