'use client'

import { useState } from 'react'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { useFacebookSdk } from '@/hooks/use-facebook-sdk'
import { Facebook, Copy, Check, Loader2, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type ChannelType = 'messenger' | 'whatsapp' | 'instagram'

interface PageOption {
  id: string
  name: string
  accessToken: string
}

interface PhoneOption {
  phoneNumberId: string
  displayNumber: string
  verifiedName: string
  accessToken: string
  wabaId: string
}

type Step =
  | { status: 'idle' }
  | { status: 'exchanging' }
  | { status: 'picking'; pages?: PageOption[]; phones?: PhoneOption[]; verifyToken: string }
  | { status: 'creating' }
  | { status: 'done'; webhookUrl: string; verifyToken: string; warnings?: string[] }
  | { status: 'error'; message: string }

const SCOPES: Record<ChannelType, string> = {
  messenger: 'pages_show_list,pages_messaging,pages_read_engagement',
  instagram: 'pages_show_list,instagram_basic,instagram_manage_messages',
  whatsapp: 'business_management,whatsapp_business_management,whatsapp_business_messaging',
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  messenger: 'Facebook Messenger',
  instagram: 'Instagram DM',
  whatsapp: 'WhatsApp Business',
}

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
  channelType: ChannelType
  onSuccess: () => void
  onCancel: () => void
}

export function MetaEmbeddedSignup({ channelType, onSuccess, onCancel }: Props) {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const { ready } = useFacebookSdk()
  const [step, setStep] = useState<Step>({ status: 'idle' })
  const [name, setName] = useState('')
  const [selectedPage, setSelectedPage] = useState<PageOption | null>(null)
  const [selectedPhone, setSelectedPhone] = useState<PhoneOption | null>(null)

  function handleConnectClick() {
    // FB.login must be called directly in the click handler — no await before it
    setStep({ status: 'exchanging' })
    window.FB.login(
      (response) => {
        if (!response.authResponse?.accessToken) {
          setStep({ status: 'idle' })
          return
        }
        handleExchange(response.authResponse.accessToken)
      },
      { scope: SCOPES[channelType] }
    )
  }

  async function handleExchange(shortLivedToken: string) {
    try {
      const data = await api.post<{ pages?: PageOption[]; phones?: PhoneOption[]; verifyToken: string }>(
        `/workspaces/${workspaceId}/meta/oauth/exchange`,
        { shortLivedToken, channelType },
        workspaceId
      )
      setStep({ status: 'picking', pages: data.pages, phones: data.phones, verifyToken: data.verifyToken })
    } catch (err) {
      setStep({ status: 'error', message: err instanceof Error ? err.message : 'Token exchange failed' })
    }
  }

  async function handleCreate() {
    if (!name.trim()) return
    const pickingStep = step as Extract<Step, { status: 'picking' }>

    let credentials: Record<string, string>
    if (channelType === 'whatsapp') {
      if (!selectedPhone) return
      credentials = {
        phoneNumberId: selectedPhone.phoneNumberId,
        accessToken: selectedPhone.accessToken,
        wabaId: selectedPhone.wabaId,
        verifyToken: pickingStep.verifyToken,
      }
    } else {
      if (!selectedPage) return
      credentials = {
        pageId: selectedPage.id,
        pageAccessToken: selectedPage.accessToken,
        verifyToken: pickingStep.verifyToken,
      }
    }

    setStep({ status: 'creating' })
    try {
      const result = await api.post<{ data: { id: string }; warnings?: string[] }>(
        `/workspaces/${workspaceId}/channels`,
        { type: channelType, name: name.trim(), credentials },
        workspaceId
      )
      const webhookUrl = channelType === 'whatsapp'
        ? `${API_URL}/webhook/whatsapp`
        : `${API_URL}/webhook/meta`
      setStep({
        status: 'done',
        webhookUrl,
        verifyToken: credentials.verifyToken,
        warnings: result.warnings,
      })
    } catch (err) {
      setStep({ status: 'error', message: err instanceof Error ? err.message : 'Channel creation failed' })
    }
  }

  if (step.status === 'done') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-1">
          <p className="text-sm font-semibold text-green-800">{CHANNEL_LABELS[channelType]} connected!</p>
          <p className="text-xs text-green-700">Webhook registered automatically. No manual setup needed.</p>
        </div>

        {step.warnings && step.warnings.length > 0 && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 space-y-1">
            <p className="text-xs font-semibold text-yellow-800">Webhook subscription warnings — messages may not arrive:</p>
            {step.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700">{w}</p>)}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Webhook URL</p>
            <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
              <code className="text-xs break-all flex-1">{step.webhookUrl}</code>
              <CopyButton value={step.webhookUrl} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Verify Token</p>
            <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
              <code className="text-xs break-all flex-1">{step.verifyToken}</code>
              <CopyButton value={step.verifyToken} />
            </div>
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

  if (step.status === 'picking') {
    const isWhatsApp = channelType === 'whatsapp'
    const canSubmit = name.trim() && (isWhatsApp ? !!selectedPhone : !!selectedPage)

    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Channel Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`My ${CHANNEL_LABELS[channelType]}`}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {isWhatsApp ? 'Select phone number' : 'Select page'}
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {isWhatsApp
              ? (step.phones ?? []).map((ph) => (
                  <label
                    key={ph.phoneNumberId}
                    className="flex items-center gap-3 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <input
                      type="radio"
                      name="phone"
                      checked={selectedPhone?.phoneNumberId === ph.phoneNumberId}
                      onChange={() => setSelectedPhone(ph)}
                      className="shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium">{ph.verifiedName}</p>
                      <p className="text-xs text-muted-foreground">{ph.displayNumber}</p>
                    </div>
                  </label>
                ))
              : (step.pages ?? []).map((pg) => (
                  <label
                    key={pg.id}
                    className="flex items-center gap-3 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <input
                      type="radio"
                      name="page"
                      checked={selectedPage?.id === pg.id}
                      onChange={() => setSelectedPage(pg)}
                      className="shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium">{pg.name}</p>
                      <p className="text-xs text-muted-foreground">ID: {pg.id}</p>
                    </div>
                  </label>
                ))}

            {(isWhatsApp ? step.phones ?? [] : step.pages ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isWhatsApp
                  ? 'No WhatsApp Business phone numbers found. Make sure your account has a verified WABA.'
                  : channelType === 'instagram'
                  ? 'No Instagram Business accounts found. Ensure your Page is connected to an Instagram Business account.'
                  : 'No Facebook Pages found. Make sure you manage at least one Page.'}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            Connect
          </button>
          <button type="button" onClick={onCancel} className="border px-4 py-2 rounded-md text-sm">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (step.status === 'creating') {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Creating channel…
      </div>
    )
  }

  // idle or exchanging
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click below to connect your {CHANNEL_LABELS[channelType]} account via Facebook login. No tokens to copy.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConnectClick}
          disabled={!ready || step.status === 'exchanging'}
          className="flex items-center gap-2 bg-[#1877F2] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#166FE5] transition-colors disabled:opacity-50"
        >
          {step.status === 'exchanging' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Facebook className="h-4 w-4" />
          )}
          {step.status === 'exchanging' ? 'Fetching your pages…' : 'Connect with Facebook'}
        </button>
        <button type="button" onClick={onCancel} className="border px-4 py-2 rounded-md text-sm">
          Cancel
        </button>
      </div>
      {!ready && <p className="text-xs text-muted-foreground">Loading Facebook SDK…</p>}
    </div>
  )
}
