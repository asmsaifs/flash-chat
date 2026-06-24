import type {
  ChannelType,
  ConversationStatus,
  MemberRole,
  MessageDirection,
  SentimentLabel,
  FlowNodeType,
  BroadcastStatus,
  PlanName,
} from './constants'

export interface Workspace {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  plan: PlanName
  aiModel: string
  createdAt: Date
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: MemberRole
  email: string
  name: string
  avatarUrl: string | null
}

export interface Channel {
  id: string
  workspaceId: string
  type: ChannelType
  name: string
  isActive: boolean
  createdAt: Date
}

export interface Contact {
  id: string
  workspaceId: string
  externalId: string | null
  channelType: ChannelType | null
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  locale: string | null
  timezone: string | null
  isSubscribed: boolean
  tags: string[]
  customFields: Record<string, unknown>
  subscribedAt: Date
  lastSeenAt: Date | null
}

export interface Conversation {
  id: string
  workspaceId: string
  contactId: string
  channelId: string
  status: ConversationStatus
  assignedAgentId: string | null
  activeFlowExecutionId: string | null
  unreadCount: number
  lastMessageAt: Date | string | null
  snoozedUntil: Date | string | null
  contact?: Contact & { tags?: Array<{ tag: string }> }
  channel?: { id: string; type: string; name: string }
  lastMessage?: Message
  messages?: Message[]
}

export interface Message {
  id: string
  conversationId: string
  direction: MessageDirection
  content: MessageContent
  status: 'sent' | 'delivered' | 'read' | 'failed'
  sentiment: SentimentLabel | null
  sentAt: Date
  deliveredAt: Date | null
  readAt: Date | null
  agentId: string | null
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'video'; url: string; caption?: string }
  | { type: 'document'; url: string; filename: string }
  | { type: 'quick_replies'; text: string; replies: Array<{ id: string; label: string }> }
  | { type: 'buttons'; text: string; buttons: Array<{ id: string; label: string; url?: string }> }
  | { type: 'card'; title: string; subtitle?: string; imageUrl?: string; buttons?: Array<{ id: string; label: string; url?: string }> }
  | { type: 'carousel'; cards: Array<{ title: string; subtitle?: string; imageUrl?: string; buttons?: Array<{ id: string; label: string; url?: string }> }> }

export interface Flow {
  id: string
  workspaceId: string
  name: string
  description: string | null
  isPublished: boolean
  nodes: FlowNode[]
  edges: FlowEdge[]
  createdAt: Date
  updatedAt: Date
}

export interface FlowNode {
  id: string
  type: FlowNodeType
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface FlowEdge {
  id: string
  source: string
  sourceHandle: string | null
  target: string
  label?: string
}

export interface Broadcast {
  id: string
  workspaceId: string
  name: string
  status: BroadcastStatus
  audienceType: 'segment' | 'tag' | 'all'
  audienceTag: string | null
  content: MessageContent
  scheduledAt: Date | string | null
  sentAt: Date | string | null
  statsTotal: number
  statsSent: number
  statsDelivered: number
  statsRead: number
  statsFailed: number
}

export interface KnowledgeBaseItem {
  id: string
  workspaceId: string
  title: string
  content: string
  sourceUrl: string | null
  sourceType: 'manual' | 'pdf' | 'url' | 'youtube'
  createdAt: Date
}

export interface ApiResponse<T> {
  data: T
  meta?: {
    total?: number
    page?: number
    pageSize?: number
  }
}

export interface ApiError {
  error: string
  message: string
  statusCode: number
}

export interface PaginationQuery {
  page?: number
  pageSize?: number
  search?: string
}
