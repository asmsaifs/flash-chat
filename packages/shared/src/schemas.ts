import { z } from 'zod'
import { CHANNEL_TYPES, MEMBER_ROLES, FLOW_NODE_TYPES, PLAN_NAMES } from './constants'

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
})

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(MEMBER_ROLES),
})

export const CreateChannelSchema = z.object({
  type: z.enum(CHANNEL_TYPES),
  name: z.string().min(1).max(100),
  credentials: z.record(z.string()),
})

export const CreateContactSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
})

export const CreateFlowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
})

export const SaveFlowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(FLOW_NODE_TYPES),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.unknown()),
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    sourceHandle: z.string().nullable(),
    target: z.string(),
    label: z.string().optional(),
  })),
})

export const CreateBroadcastSchema = z.object({
  name: z.string().min(1).max(200),
  channelIds: z.array(z.string().uuid()).min(1),
  audienceType: z.enum(['segment', 'tag', 'all']),
  audienceValue: z.string().nullable(),
  content: z.object({ type: z.string() }).passthrough(),
  scheduledAt: z.string().datetime().nullable(),
})

export const CreateKnowledgeBaseItemSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  sourceType: z.enum(['manual', 'pdf', 'url', 'youtube']),
})

export const UpdateWorkspaceSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
  aiModel: z.string().optional(),
})

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
})
