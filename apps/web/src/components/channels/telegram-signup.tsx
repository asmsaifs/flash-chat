'use client'

import { useState } from 'react'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { Send, Copy, Check, Loader2, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type Step =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'done'; channelId: string; warnings?: string[] }
  | { status: 'error'; message: string }

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={copy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

export function TelegramSignup({ onSuccess, onCancel }: Props) {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const [step, setStep] = useState<Step>({ status: 'idle' })
  const [name, setName] = useState('')
  const [botToken, setBotToken] = useState('')

  async function handleConnect() {
    if (!name.trim() || !botToken.trim()) return
    setStep({ status: 'connecting' })
    try {
      const result = await api.post<{ data: { id: string }; warnings?: string[] }>(
        `/workspaces/${workspaceId}/channels`,
        { type: 'telegram', name: name.trim(), credentials: { botToken: botToken.trim() } },
        workspaceId
      )
      setStep({ status: 'done', channelId: result.data.id, warnings: result.warnings })
    } catch (err) {
      setStep({ status: 'error', message: err instanceof Error ? err.message : 'Channel creation failed' })
    }
  }

  if (step.status === 'done') {
    const webhookUrl = `${API_URL}/webhook/telegram/${step.channelId}`
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-1">
          <p className="text-sm font-semibold text-green-800">Telegram bot connected!</p>
          <p className="text-xs text-green-700">Webhook registered automatically. No manual setup needed.</p>
        </div>

        {step.warnings && step.warnings.length > 0 && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 space-y-1">
            <p className="text-xs font-semibold text-yellow-800">Webhook registration warnings — messages may not arrive:</p>
            {step.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700">{w}</p>)}
          </div>
        )}

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Webhook URL</p>
          <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
            <code className="text-xs break-all flex-1">{webhookUrl}</code>
            <CopyButton value={webhookUrl} />
          </div>
        </div>

        <button
          type="button"
          onClick={onSuccess}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium"
        >
          Done
        </button>
      </div>
    )
  }

  if (step.status === 'error') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-4">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{step.message}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep({ status: 'idle' })}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium"
          >
            Try again
          </button>
          <button type="button" onClick={onCancel} className="border px-4 py-2 rounded-md text-sm">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (step.status === 'connecting') {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting bot and registering webhook…
      </div>
    )
  }

  // idle
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter your bot token from BotFather. The webhook will be registered automatically — no manual setup needed.
      </p>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Channel Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Telegram Bot"
          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Bot Token</label>
        <input
          type="password"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="123456:ABCdef…"
          className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Get this from <span className="font-medium">@BotFather</span> → /newbot or /token
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConnect}
          disabled={!name.trim() || !botToken.trim()}
          className="flex items-center gap-2 bg-[#0ea5e9] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#0284c7] transition-colors disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Connect Telegram Bot
        </button>
        <button type="button" onClick={onCancel} className="border px-4 py-2 rounded-md text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}
