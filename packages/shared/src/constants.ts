export const CHANNEL_TYPES = ['web_widget', 'whatsapp', 'telegram', 'messenger', 'instagram'] as const
export type ChannelType = (typeof CHANNEL_TYPES)[number]

export const MEMBER_ROLES = ['owner', 'admin', 'agent'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

export const CONVERSATION_STATUSES = ['open', 'assigned', 'resolved', 'snoozed'] as const
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number]

export const SENTIMENT_LABELS = ['positive', 'neutral', 'negative', 'urgent'] as const
export type SentimentLabel = (typeof SENTIMENT_LABELS)[number]

export const FLOW_NODE_TYPES = [
  'trigger',
  'message',
  'condition',
  'user_input',
  'action',
  'ai_reply',
  'delay',
  'webhook',
  'live_chat',
  'broadcast',
] as const
export type FlowNodeType = (typeof FLOW_NODE_TYPES)[number]

export const BROADCAST_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed'] as const
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number]

export const PLAN_NAMES = ['free', 'pro', 'business', 'agency'] as const
export type PlanName = (typeof PLAN_NAMES)[number]

export const PLAN_LIMITS: Record<PlanName, { subscribers: number; broadcasts: number; aiReplies: number }> = {
  free:     { subscribers: 500,    broadcasts: 2,          aiReplies: 100 },
  pro:      { subscribers: 5000,   broadcasts: Infinity,   aiReplies: 1000 },
  business: { subscribers: 25000,  broadcasts: Infinity,   aiReplies: 10000 },
  agency:   { subscribers: Infinity, broadcasts: Infinity, aiReplies: Infinity },
}

export const AI_MODELS = [
  { id: 'anthropic/claude-sonnet-4-6',    label: 'Claude Sonnet 4.6 (Recommended)' },
  { id: 'anthropic/claude-haiku-4-5',     label: 'Claude Haiku 4.5 (Fast)' },
  { id: 'openai/gpt-4o',                  label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini',             label: 'GPT-4o Mini (Fast)' },
  { id: 'google/gemini-2.5-pro',          label: 'Gemini 2.5 Pro' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
] as const
