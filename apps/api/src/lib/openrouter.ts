import OpenAI from 'openai'

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL ?? 'https://flashchat.app',
    'X-Title': 'FlashChat',
  },
})

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openrouter.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

export async function chat(
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: Partial<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming>
): Promise<string> {
  const response = await openrouter.chat.completions.create({
    model,
    messages,
    ...options,
  })
  return response.choices[0].message.content ?? ''
}

export async function chatJson<T>(
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  schema: { parse: (val: unknown) => T }
): Promise<T> {
  const response = await openrouter.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_object' },
  })
  const content = response.choices[0].message.content ?? '{}'
  return schema.parse(JSON.parse(content))
}
