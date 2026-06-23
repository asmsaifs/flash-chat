import { prisma } from '@flashchat/database'
import { z } from 'zod'
import { chat, chatJson, generateEmbedding } from '../lib/openrouter.js'

const SentimentSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'urgent']),
  confidence: z.number().min(0).max(1),
})

const FlowSuggestionSchema = z.object({
  nodeType: z.string(),
  content: z.record(z.unknown()),
  reasoning: z.string(),
})

export async function analyzeSentiment(
  text: string,
  model: string
): Promise<{ sentiment: 'positive' | 'neutral' | 'negative' | 'urgent'; confidence: number }> {
  return chatJson(model, [
    {
      role: 'system',
      content:
        'Classify the sentiment of customer messages. Return JSON with sentiment (positive/neutral/negative/urgent) and confidence (0-1). "urgent" means the customer needs immediate help or is very frustrated.',
    },
    { role: 'user', content: text },
  ], SentimentSchema)
}

export async function generateAiReply(
  workspaceId: string,
  model: string,
  userMessage: string,
  conversationContext: string[]
): Promise<{ reply: string; confidence: number; usedKnowledge: boolean }> {
  // RAG: find relevant knowledge base items
  const embedding = await generateEmbedding(userMessage)
  const embeddingStr = `[${embedding.join(',')}]`

  const knowledgeItems = await prisma.$queryRaw<{ content: string; title: string }[]>`
    SELECT content, title
    FROM knowledge_base_items
    WHERE workspace_id = ${workspaceId}::uuid
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT 5
  `

  const hasKnowledge = knowledgeItems.length > 0
  const knowledgeContext = hasKnowledge
    ? `\n\nRelevant knowledge:\n${knowledgeItems.map((k) => `[${k.title}]: ${k.content}`).join('\n\n')}`
    : ''

  const systemPrompt = `You are a helpful customer support assistant.${knowledgeContext}

Answer the customer's question based on the knowledge provided. If you cannot answer confidently, respond with: "I'll connect you with a human agent who can better assist you."

Be concise, friendly, and professional.`

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...conversationContext.slice(-6).map((msg, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg,
    })),
    { role: 'user', content: userMessage },
  ]

  const reply = await chat(model, messages)

  const needsHuman =
    reply.toLowerCase().includes("human agent") ||
    reply.toLowerCase().includes("connect you with")

  return {
    reply,
    confidence: needsHuman ? 0.3 : 0.9,
    usedKnowledge: hasKnowledge,
  }
}

export async function suggestFlowNode(
  model: string,
  flowContext: {
    existingNodes: unknown[]
    currentNode: unknown
    userGoal: string
  }
): Promise<{ nodeType: string; content: Record<string, unknown>; reasoning: string }> {
  return chatJson(
    model,
    [
      {
        role: 'system',
        content: `You are a chat flow builder assistant. Given the current flow context, suggest the best next node.
Available node types: trigger, message, condition, user_input, action, ai_reply, delay, webhook, live_chat, broadcast.
Return JSON with: nodeType, content (node-specific config), reasoning (1 sentence why).`,
      },
      {
        role: 'user',
        content: JSON.stringify(flowContext),
      },
    ],
    FlowSuggestionSchema
  )
}

export async function logAiUsage(
  workspaceId: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  feature: string
) {
  await prisma.aiUsageLog.create({
    data: { workspaceId, model, promptTokens, completionTokens, feature },
  })
}
