import { prisma } from '@flashchat/database'
import type { FlowExecution, Conversation, Contact, Workspace } from '@flashchat/database'
import type { FlowNode, FlowEdge, MessageContent } from '@flashchat/shared'
import { generateAiReply, analyzeSentiment } from './ai.service.js'
import { sendChannelMessage } from './channel.service.js'
import { emitToWorkspace, emitToWidgetConversation } from '../lib/socket.js'
import { Queue } from 'bullmq'
import { redis } from '../lib/redis.js'

export const flowDelayQueue = new Queue('flow-execution-delay', { connection: redis as never })

interface ExecutionContext {
  execution: FlowExecution
  conversation: Conversation
  contact: Contact
  workspace: Workspace
  nodes: FlowNode[]
  edges: FlowEdge[]
  variables: Record<string, unknown>
}

export async function startFlowExecution(
  flowId: string,
  contactId: string,
  conversationId: string
): Promise<FlowExecution> {
  const flow = await prisma.flow.findUniqueOrThrow({ where: { id: flowId } })
  const nodes = flow.nodes as unknown as FlowNode[]
  const triggerNode = nodes.find((n) => n.type === 'trigger')

  if (!triggerNode) throw new Error('Flow has no trigger node')

  const execution = await prisma.flowExecution.create({
    data: {
      flowId,
      contactId,
      currentNodeId: triggerNode.id,
      status: 'running',
      context: {},
    },
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { activeFlowExecutionId: execution.id },
  })

  await processNode(execution.id, conversationId, triggerNode.id)
  return execution
}

export async function resumeFlowExecution(
  executionId: string,
  conversationId: string,
  userInput: string
): Promise<void> {
  const execution = await prisma.flowExecution.findUniqueOrThrow({
    where: { id: executionId },
  })

  if (execution.status !== 'waiting_input') return

  const ctx = execution.context as Record<string, unknown>

  // Validate input if a validation type was set
  const validationType = ctx['validationType'] as string | undefined
  if (validationType && validationType !== 'none') {
    const validationError = getValidationError(userInput, validationType)
    if (validationError) {
      const promptContent = ctx['promptContent'] as MessageContent | undefined
      if (promptContent) {
        const conv = await prisma.conversation.findUniqueOrThrow({
          where: { id: conversationId },
          include: { contact: true, channel: true },
        })
        const errorMsg: MessageContent = { type: 'text', text: validationError }
        await sendChannelMessage(conv.channelId, conv.contact, errorMsg, conversationId)
        await saveOutboundMessage(conversationId, errorMsg)
        await sendChannelMessage(conv.channelId, conv.contact, promptContent, conversationId)
        await saveOutboundMessage(conversationId, promptContent)
      }
      return
    }
  }

  const captureField = ctx['captureField'] as string | undefined

  if (captureField) {
    await prisma.contact.update({
      where: { id: execution.contactId },
      data: { customFields: { ...(ctx['existingFields'] as object ?? {}), [captureField]: userInput } },
    })
  }

  const nextNodeId = ctx['nextNodeId'] as string | undefined
  if (!nextNodeId) {
    await completeExecution(executionId, conversationId)
    return
  }

  await prisma.flowExecution.update({
    where: { id: executionId },
    data: { status: 'running', currentNodeId: nextNodeId },
  })

  await processNode(executionId, conversationId, nextNodeId)
}

export async function processNode(executionId: string, conversationId: string, nodeId: string): Promise<void> {
  const execution = await prisma.flowExecution.findUniqueOrThrow({ where: { id: executionId } })
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { contact: true, channel: true, workspace: true },
  })

  const flow = await prisma.flow.findUniqueOrThrow({ where: { id: execution.flowId } })
  const nodes = flow.nodes as unknown as FlowNode[]
  const edges = flow.edges as unknown as FlowEdge[]
  const node = nodes.find((n) => n.id === nodeId)

  if (!node) {
    await completeExecution(executionId, conversationId)
    return
  }

  const ctx: ExecutionContext = {
    execution,
    conversation,
    contact: conversation.contact,
    workspace: conversation.workspace,
    nodes,
    edges,
    variables: (execution.context as Record<string, unknown>) ?? {},
  }

  switch (node.type) {
    case 'trigger':
      await goToNext(ctx, executionId, conversationId, nodeId)
      break

    case 'message':
      await handleMessageNode(ctx, executionId, conversationId, node)
      break

    case 'condition':
      await handleConditionNode(ctx, executionId, conversationId, node)
      break

    case 'user_input':
      await handleUserInputNode(ctx, executionId, conversationId, node)
      break

    case 'action':
      await handleActionNode(ctx, executionId, conversationId, node)
      break

    case 'ai_reply':
      await handleAiReplyNode(ctx, executionId, conversationId, node)
      break

    case 'delay':
      await handleDelayNode(ctx, executionId, conversationId, node)
      break

    case 'live_chat':
      await handleLiveChatNode(ctx, executionId, conversationId, node)
      break

    case 'webhook':
      await handleWebhookNode(ctx, executionId, conversationId, node)
      break

    default:
      await goToNext(ctx, executionId, conversationId, nodeId)
  }
}

async function handleMessageNode(ctx: ExecutionContext, executionId: string, conversationId: string, node: FlowNode) {
  const data = node.data as { content: MessageContent }
  const content = resolveContentVariables(data.content, ctx)
  await sendChannelMessage(ctx.conversation.channelId, ctx.contact, content, conversationId)
  await saveOutboundMessage(conversationId, content)
  await goToNext(ctx, executionId, conversationId, node.id)
}

async function handleConditionNode(ctx: ExecutionContext, executionId: string, conversationId: string, node: FlowNode) {
  const data = node.data as { field: string; operator: string; value: unknown }
  let fieldValue: unknown

  if (data.field === 'sentiment') {
    fieldValue = ctx.variables['lastSentiment']
  } else if (data.field.startsWith('tag:')) {
    const tag = data.field.replace('tag:', '')
    const tagRecord = await prisma.contactTag.findFirst({
      where: { contactId: ctx.contact.id, tag },
    })
    fieldValue = !!tagRecord
  } else {
    const cf = ctx.contact.customFields as Record<string, unknown>
    fieldValue = cf[data.field]
  }

  const matches = evaluateCondition(fieldValue, data.operator, data.value)
  const handleId = matches ? 'true' : 'false'

  const nextEdge = ctx.edges.find((e) => e.source === node.id && e.sourceHandle === handleId)
  if (nextEdge) {
    await prisma.flowExecution.update({
      where: { id: executionId },
      data: { currentNodeId: nextEdge.target },
    })
    await processNode(executionId, conversationId, nextEdge.target)
  } else {
    await completeExecution(executionId, conversationId)
  }
}

async function handleUserInputNode(ctx: ExecutionContext, executionId: string, conversationId: string, node: FlowNode) {
  const data = node.data as { prompt: MessageContent; captureField?: string; validation?: string }
  const prompt = resolveContentVariables(data.prompt, ctx)
  await sendChannelMessage(ctx.conversation.channelId, ctx.contact, prompt, conversationId)
  await saveOutboundMessage(conversationId, prompt)

  const nextEdge = ctx.edges.find((e) => e.source === node.id)
  await prisma.flowExecution.update({
    where: { id: executionId },
    data: {
      status: 'waiting_input',
      currentNodeId: node.id,
      context: {
        ...ctx.variables,
        captureField: data.captureField,
        validationType: data.validation ?? 'none',
        promptContent: prompt,
        nextNodeId: nextEdge?.target,
        existingFields: ctx.contact.customFields,
      },
    },
  })
}

async function handleActionNode(ctx: ExecutionContext, executionId: string, conversationId: string, node: FlowNode) {
  const data = node.data as { actionType: string; tag?: string; field?: string; value?: unknown }

  if (data.actionType === 'add_tag' && data.tag) {
    await prisma.contactTag.upsert({
      where: { contactId_tag: { contactId: ctx.contact.id, tag: data.tag } },
      update: {},
      create: { contactId: ctx.contact.id, tag: data.tag },
    })
  } else if (data.actionType === 'remove_tag' && data.tag) {
    await prisma.contactTag.deleteMany({
      where: { contactId: ctx.contact.id, tag: data.tag },
    })
  } else if (data.actionType === 'set_field' && data.field) {
    const cf = ctx.contact.customFields as Record<string, unknown>
    await prisma.contact.update({
      where: { id: ctx.contact.id },
      data: { customFields: { ...cf, [data.field]: data.value } as never },
    })
  }

  await goToNext(ctx, executionId, conversationId, node.id)
}

async function handleAiReplyNode(ctx: ExecutionContext, executionId: string, conversationId: string, node: FlowNode) {
  const recentMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { sentAt: 'desc' },
    take: 12,
  })

  const conversationHistory = recentMessages
    .reverse()
    .map((m) => {
      const c = m.content as { text?: string }
      return c.text ?? ''
    })
    .filter(Boolean)

  const data = node.data as { fallbackToHuman?: boolean }
  const lastMessage = conversationHistory.at(-1) ?? ''

  const { reply, confidence } = await generateAiReply(
    ctx.workspace.id,
    ctx.workspace.aiModel,
    lastMessage,
    conversationHistory
  )

  if (confidence < 0.5 && data.fallbackToHuman) {
    await handleLiveChatNode(ctx, executionId, conversationId)
    return
  }

  const { sentiment } = await analyzeSentiment(lastMessage, ctx.workspace.aiModel)
  const updatedVariables = { ...ctx.variables, lastSentiment: sentiment }
  await prisma.flowExecution.update({
    where: { id: executionId },
    data: { context: updatedVariables },
  })
  ctx.variables = updatedVariables

  const content: MessageContent = { type: 'text', text: reply }
  await sendChannelMessage(ctx.conversation.channelId, ctx.contact, content, conversationId)
  await saveOutboundMessage(conversationId, content)
  await goToNext(ctx, executionId, conversationId, node.id)
}

async function handleDelayNode(ctx: ExecutionContext, executionId: string, conversationId: string, node: FlowNode) {
  const data = node.data as { delayMs: number }
  const delayMs = data.delayMs ?? 0

  const nextEdge = ctx.edges.find((e) => e.source === node.id)
  if (!nextEdge) {
    await completeExecution(executionId, conversationId)
    return
  }

  await prisma.flowExecution.update({
    where: { id: executionId },
    data: { status: 'paused', currentNodeId: node.id },
  })

  await flowDelayQueue.add(
    'resume',
    { executionId, conversationId, nodeId: nextEdge.target },
    { delay: delayMs }
  )
}

async function handleLiveChatNode(ctx: ExecutionContext, executionId: string, conversationId: string, node?: FlowNode) {
  const data = node?.data as { handoffMessage?: string; notifyAgents?: boolean } | undefined
  if (data?.handoffMessage) {
    const content: MessageContent = { type: 'text', text: data.handoffMessage }
    await sendChannelMessage(ctx.conversation.channelId, ctx.contact, content, conversationId)
    await saveOutboundMessage(conversationId, content)
  }
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'open', activeFlowExecutionId: null },
  })
  await prisma.flowExecution.update({
    where: { id: executionId },
    data: { status: 'paused' },
  })
  if (data?.notifyAgents !== false) {
    emitToWorkspace(ctx.workspace.id, 'conversation:needs_agent', { conversationId })
  }
}

async function handleWebhookNode(ctx: ExecutionContext, executionId: string, conversationId: string, node: FlowNode) {
  const data = node.data as { url: string; method?: string; headers?: Record<string, string> }
  const { default: axios } = await import('axios')

  try {
    await axios({
      method: data.method ?? 'POST',
      url: data.url,
      headers: data.headers,
      data: {
        contactId: ctx.contact.id,
        conversationId,
        variables: ctx.variables,
      },
    })
  } catch (err) {
    console.error('[FlowEngine] Webhook error:', err)
  }

  await goToNext(ctx, executionId, conversationId, node.id)
}

async function goToNext(ctx: ExecutionContext, executionId: string, conversationId: string, fromNodeId: string) {
  const nextEdge = ctx.edges.find((e) => e.source === fromNodeId)
  if (!nextEdge) {
    await completeExecution(executionId, conversationId)
    return
  }
  await prisma.flowExecution.update({
    where: { id: executionId },
    data: { currentNodeId: nextEdge.target },
  })
  await processNode(executionId, conversationId, nextEdge.target)
}

async function completeExecution(executionId: string, conversationId: string) {
  await prisma.flowExecution.update({
    where: { id: executionId },
    data: { status: 'completed', completedAt: new Date() },
  })
  await prisma.conversation.update({
    where: { id: conversationId, activeFlowExecutionId: executionId },
    data: { activeFlowExecutionId: null },
  }).catch((err: unknown) => {
    console.error('[flow-engine] conversation status update failed:', err)
  })
}

async function saveOutboundMessage(conversationId: string, content: MessageContent) {
  const msg = await prisma.message.create({
    data: { conversationId, direction: 'outbound', content: content as object, status: 'sent' },
  })
  const conv = await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
    include: { workspace: true, channel: true },
  })
  emitToWorkspace(conv.workspaceId, 'message:new', { conversationId, message: msg })
  if (conv.channel.type === 'web_widget') {
    emitToWidgetConversation(conversationId, 'message:receive', { content })
  }
}

function resolveVars(text: string, ctx: ExecutionContext): string {
  const cf = ctx.contact.customFields as Record<string, unknown>
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (key === 'first_name') return ctx.contact.firstName ?? ''
    if (key === 'last_name') return ctx.contact.lastName ?? ''
    if (key === 'email') return ctx.contact.email ?? ''
    if (key === 'phone') return ctx.contact.phone ?? ''
    return String(ctx.variables[key] ?? cf[key] ?? `{{${key}}}`)
  })
}

function resolveContentVariables(content: MessageContent, ctx: ExecutionContext): MessageContent {
  if (content.type === 'text') return { ...content, text: resolveVars(content.text, ctx) }
  if (content.type === 'quick_replies') return { ...content, text: resolveVars(content.text, ctx) }
  if (content.type === 'buttons') return { ...content, text: resolveVars(content.text, ctx) }
  if (content.type === 'image' && content.caption) return { ...content, caption: resolveVars(content.caption, ctx) }
  return content
}

function getValidationError(input: string, validationType: string): string | null {
  if (validationType === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) ? null : 'Please enter a valid email address.'
  }
  if (validationType === 'phone') {
    return /^\+?[\d\s\-().]{7,}$/.test(input) ? null : 'Please enter a valid phone number.'
  }
  if (validationType === 'number') {
    return /^-?\d+(\.\d+)?$/.test(input.trim()) ? null : 'Please enter a valid number.'
  }
  return null
}

function evaluateCondition(value: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case 'eq': return value === expected
    case 'neq': return value !== expected
    case 'contains': return String(value).includes(String(expected))
    case 'gt': return Number(value) > Number(expected)
    case 'lt': return Number(value) < Number(expected)
    case 'is_true': return Boolean(value) === true
    case 'is_false': return Boolean(value) === false
    default: return false
  }
}
