import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { CreateKnowledgeBaseItemSchema } from '@flashchat/shared'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'
import { generateEmbedding } from '../lib/openrouter.js'

export async function knowledgeBaseRoutes(app: FastifyInstance) {
  const preHandler = [authMiddleware, workspaceMiddleware]

  app.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/knowledge-base',
    { preHandler },
    async (req, reply) => {
      const items = await prisma.knowledgeBaseItem.findMany({
        where: { workspaceId: req.workspaceId },
        select: { id: true, title: true, sourceUrl: true, sourceType: true, createdAt: true, content: true },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send({ data: items })
    }
  )

  app.post<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/knowledge-base',
    { preHandler },
    async (req, reply) => {
      const body = CreateKnowledgeBaseItemSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Validation', message: body.error.message, statusCode: 400 })

      // Generate embedding
      const embeddingVector = await generateEmbedding(`${body.data.title}\n\n${body.data.content}`)
      const embeddingStr = `[${embeddingVector.join(',')}]`

      const item = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO knowledge_base_items (id, workspace_id, title, content, source_url, source_type, embedding)
        VALUES (
          uuid_generate_v4(),
          ${req.workspaceId}::uuid,
          ${body.data.title},
          ${body.data.content},
          ${body.data.sourceUrl ?? null},
          ${body.data.sourceType}::"SourceType",
          ${embeddingStr}::vector
        )
        RETURNING id
      `

      return reply.status(201).send({ data: { id: item[0].id, ...body.data } })
    }
  )

  app.delete<{ Params: { workspaceId: string; itemId: string } }>(
    '/workspaces/:workspaceId/knowledge-base/:itemId',
    { preHandler },
    async (req, reply) => {
      await prisma.knowledgeBaseItem.deleteMany({
        where: { id: req.params.itemId, workspaceId: req.workspaceId },
      })
      return reply.status(204).send()
    }
  )

  // URL ingest
  app.post<{ Params: { workspaceId: string }; Body: { url: string } }>(
    '/workspaces/:workspaceId/knowledge-base/ingest-url',
    { preHandler },
    async (req, reply) => {
      const { default: axios } = await import('axios')
      const response = await axios.get(req.body.url, { responseType: 'text' })

      // Simple text extraction (production: use cheerio or similar)
      const text = (response.data as string)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000)

      const embedding = await generateEmbedding(text)
      const embeddingStr = `[${embedding.join(',')}]`

      await prisma.$queryRaw`
        INSERT INTO knowledge_base_items (id, workspace_id, title, content, source_url, source_type, embedding)
        VALUES (
          uuid_generate_v4(),
          ${req.workspaceId}::uuid,
          ${req.body.url},
          ${text},
          ${req.body.url},
          'url'::"SourceType",
          ${embeddingStr}::vector
        )
      `

      return reply.status(201).send({ data: { url: req.body.url, extracted: text.length } })
    }
  )
}
