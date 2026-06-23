import type { FastifyInstance } from 'fastify'
import { prisma } from '@flashchat/database'
import { CreateFlowSchema, SaveFlowSchema } from '@flashchat/shared'
import type { FlowNode } from '@flashchat/shared'
import { authMiddleware, workspaceMiddleware } from '../middleware/auth.js'
import { suggestFlowNode } from '../services/ai.service.js'

export async function flowRoutes(app: FastifyInstance) {
  const preHandler = [authMiddleware, workspaceMiddleware]

  app.get<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/flows',
    { preHandler },
    async (req, reply) => {
      const flows = await prisma.flow.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { updatedAt: 'desc' },
      })
      return reply.send({ data: flows })
    }
  )

  app.post<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId/flows',
    { preHandler },
    async (req, reply) => {
      const body = CreateFlowSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Validation', message: body.error.message, statusCode: 400 })

      const flow = await prisma.flow.create({
        data: { workspaceId: req.workspaceId, ...body.data },
      })
      return reply.status(201).send({ data: flow })
    }
  )

  app.get<{ Params: { workspaceId: string; flowId: string } }>(
    '/workspaces/:workspaceId/flows/:flowId',
    { preHandler },
    async (req, reply) => {
      const flow = await prisma.flow.findFirstOrThrow({
        where: { id: req.params.flowId, workspaceId: req.workspaceId },
        include: { triggers: true, versions: { orderBy: { version: 'desc' }, take: 5 } },
      })
      return reply.send({ data: flow })
    }
  )

  app.put<{ Params: { workspaceId: string; flowId: string } }>(
    '/workspaces/:workspaceId/flows/:flowId',
    { preHandler },
    async (req, reply) => {
      const body = SaveFlowSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Validation', message: body.error.message, statusCode: 400 })

      const existing = await prisma.flow.findFirstOrThrow({
        where: { id: req.params.flowId, workspaceId: req.workspaceId },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      })

      const nextVersion = (existing.versions[0]?.version ?? 0) + 1

      const flow = await prisma.flow.update({
        where: { id: req.params.flowId },
        data: {
          name: body.data.name,
          description: body.data.description,
          nodes: body.data.nodes as object[],
          edges: body.data.edges as object[],
          versions: {
            create: { version: nextVersion, nodes: body.data.nodes as object[], edges: body.data.edges as object[] },
          },
        },
      })

      // Sync FlowTrigger records from trigger nodes so webhooks can match them
      const triggerNodes = (body.data.nodes as FlowNode[]).filter((n) => n.type === 'trigger')
      await prisma.flowTrigger.deleteMany({ where: { flowId: req.params.flowId } })
      if (triggerNodes.length > 0) {
        await prisma.flowTrigger.createMany({
          data: triggerNodes.map((n) => {
            const d = n.data as { triggerType?: string; keyword?: string; channelType?: string }
            return {
              flowId: req.params.flowId,
              triggerType: (d.triggerType ?? 'keyword') as never,
              keyword: d.triggerType === 'keyword' ? (d.keyword?.toLowerCase().trim() ?? null) : null,
              channelType: (d.channelType ?? null) as never,
              isActive: flow.isPublished,
            }
          }),
        })
      }

      return reply.send({ data: flow })
    }
  )

  // Publish / unpublish
  app.post<{ Params: { workspaceId: string; flowId: string }; Body: { publish: boolean } }>(
    '/workspaces/:workspaceId/flows/:flowId/publish',
    { preHandler },
    async (req, reply) => {
      const [flow] = await Promise.all([
        prisma.flow.update({
          where: { id: req.params.flowId },
          data: { isPublished: req.body.publish },
        }),
        prisma.flowTrigger.updateMany({
          where: { flowId: req.params.flowId },
          data: { isActive: req.body.publish },
        }),
      ])
      return reply.send({ data: flow })
    }
  )

  app.delete<{ Params: { workspaceId: string; flowId: string } }>(
    '/workspaces/:workspaceId/flows/:flowId',
    { preHandler },
    async (req, reply) => {
      await prisma.flow.delete({ where: { id: req.params.flowId } })
      return reply.status(204).send()
    }
  )

  // AI flow suggestion
  app.post<{ Params: { workspaceId: string }; Body: { existingNodes: unknown[]; currentNode: unknown; userGoal: string } }>(
    '/workspaces/:workspaceId/flows/ai-suggest',
    { preHandler },
    async (req, reply) => {
      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: req.workspaceId } })
      const suggestion = await suggestFlowNode(workspace.aiModel, req.body)
      return reply.send({ data: suggestion })
    }
  )
}
