'use client'

import { X } from 'lucide-react'
import type { Node } from '@xyflow/react'

interface Props {
  node: Node
  onUpdate: (data: Record<string, unknown>) => void
  onClose: () => void
}

export function NodePanel({ node, onUpdate, onClose }: Props) {
  const data = node.data as Record<string, unknown>

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold capitalize text-sm">{node.type?.replace('_', ' ')} Node</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {node.type === 'trigger' && (
          <TriggerEditor data={data} onUpdate={onUpdate} />
        )}
        {node.type === 'message' && (
          <MessageEditor data={data} onUpdate={onUpdate} />
        )}
        {node.type === 'condition' && (
          <ConditionEditor data={data} onUpdate={onUpdate} />
        )}
        {node.type === 'action' && (
          <ActionEditor data={data} onUpdate={onUpdate} />
        )}
        {node.type === 'ai_reply' && (
          <AiReplyEditor data={data} onUpdate={onUpdate} />
        )}
        {node.type === 'delay' && (
          <DelayEditor data={data} onUpdate={onUpdate} />
        )}
        {node.type === 'webhook' && (
          <WebhookEditor data={data} onUpdate={onUpdate} />
        )}
        {node.type === 'user_input' && (
          <UserInputEditor data={data} onUpdate={onUpdate} />
        )}
        {node.type === 'live_chat' && (
          <LiveChatEditor data={data} onUpdate={onUpdate} />
        )}
        {!['trigger', 'message', 'condition', 'action', 'ai_reply', 'delay', 'webhook', 'user_input', 'live_chat'].includes(node.type ?? '') && (
          <p className="text-sm text-muted-foreground">No configuration needed for this node type.</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm border rounded-md px-3 py-2 bg-background outline-none focus:ring-2 focus:ring-ring"
    />
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm border rounded-md px-3 py-2 bg-background outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function TriggerEditor({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (d: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Trigger Type">
        <Select
          value={data.triggerType as string ?? 'keyword'}
          onChange={(v) => onUpdate({ triggerType: v })}
          options={[
            { value: 'keyword', label: 'Keyword Match' },
            { value: 'first_message', label: 'First Message' },
            { value: 'opt_in', label: 'Opt-in' },
            { value: 'button_click', label: 'Button Click' },
          ]}
        />
      </Field>
      {(data.triggerType === 'keyword' || !data.triggerType) && (
        <Field label="Keyword">
          <Input value={data.keyword as string ?? ''} onChange={(v) => onUpdate({ keyword: v })} placeholder="e.g. start" />
        </Field>
      )}
      <Field label="Channel">
        <Select
          value={data.channelType as string ?? ''}
          onChange={(v) => onUpdate({ channelType: v || null })}
          options={[
            { value: '', label: 'All Channels' },
            { value: 'web_widget', label: 'Web Widget' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'telegram', label: 'Telegram' },
            { value: 'messenger', label: 'Messenger' },
            { value: 'instagram', label: 'Instagram' },
          ]}
        />
      </Field>
    </>
  )
}

function MessageEditor({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (d: Record<string, unknown>) => void }) {
  const content = (data.content as Record<string, unknown>) ?? { type: 'text', text: '' }
  return (
    <>
      <Field label="Message Type">
        <Select
          value={content.type as string ?? 'text'}
          onChange={(v) => onUpdate({ content: { ...content, type: v } })}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'image', label: 'Image' },
            { value: 'quick_replies', label: 'Quick Replies' },
            { value: 'buttons', label: 'Buttons' },
          ]}
        />
      </Field>
      <Field label="Text">
        <textarea
          value={content.text as string ?? ''}
          onChange={(e) => onUpdate({ content: { ...content, text: e.target.value } })}
          placeholder="Type your message… Use {{first_name}} for variables"
          rows={4}
          className="w-full text-sm border rounded-md px-3 py-2 bg-background outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </Field>
    </>
  )
}

function ConditionEditor({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (d: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Field">
        <Input value={data.field as string ?? ''} onChange={(v) => onUpdate({ field: v })} placeholder="e.g. sentiment, tag:vip" />
      </Field>
      <Field label="Operator">
        <Select
          value={data.operator as string ?? 'eq'}
          onChange={(v) => onUpdate({ operator: v })}
          options={[
            { value: 'eq', label: 'equals' },
            { value: 'neq', label: 'not equals' },
            { value: 'contains', label: 'contains' },
            { value: 'gt', label: 'greater than' },
            { value: 'lt', label: 'less than' },
            { value: 'is_true', label: 'is true' },
          ]}
        />
      </Field>
      <Field label="Value">
        <Input value={String(data.value ?? '')} onChange={(v) => onUpdate({ value: v })} placeholder="e.g. negative" />
      </Field>
    </>
  )
}

function ActionEditor({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (d: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Action Type">
        <Select
          value={data.actionType as string ?? 'add_tag'}
          onChange={(v) => onUpdate({ actionType: v })}
          options={[
            { value: 'add_tag', label: 'Add Tag' },
            { value: 'remove_tag', label: 'Remove Tag' },
            { value: 'set_field', label: 'Set Custom Field' },
          ]}
        />
      </Field>
      {['add_tag', 'remove_tag'].includes(data.actionType as string ?? 'add_tag') && (
        <Field label="Tag">
          <Input value={data.tag as string ?? ''} onChange={(v) => onUpdate({ tag: v })} placeholder="e.g. vip-customer" />
        </Field>
      )}
      {data.actionType === 'set_field' && (
        <>
          <Field label="Field Name">
            <Input value={data.field as string ?? ''} onChange={(v) => onUpdate({ field: v })} placeholder="e.g. plan" />
          </Field>
          <Field label="Value">
            <Input value={String(data.value ?? '')} onChange={(v) => onUpdate({ value: v })} placeholder="e.g. pro" />
          </Field>
        </>
      )}
    </>
  )
}

function AiReplyEditor({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (d: Record<string, unknown>) => void }) {
  return (
    <Field label="Options">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={data.fallbackToHuman as boolean ?? false}
          onChange={(e) => onUpdate({ fallbackToHuman: e.target.checked })}
          className="rounded"
        />
        Fallback to human agent if confidence &lt; 50%
      </label>
    </Field>
  )
}

function DelayEditor({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (d: Record<string, unknown>) => void }) {
  return (
    <Field label="Delay (seconds)">
      <Input
        value={String((data.delayMs as number ?? 0) / 1000)}
        onChange={(v) => onUpdate({ delayMs: Number(v) * 1000 })}
        placeholder="e.g. 5"
      />
    </Field>
  )
}

function UserInputEditor({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (d: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Prompt">
        <textarea
          value={data.prompt as string ?? ''}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
          placeholder="e.g. What is your email address?"
          rows={3}
          className="w-full text-sm border rounded-md px-3 py-2 bg-background outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </Field>
      <Field label="Save to Variable">
        <Input value={data.variableName as string ?? ''} onChange={(v) => onUpdate({ variableName: v })} placeholder="e.g. email" />
      </Field>
      <Field label="Validation">
        <Select
          value={data.validation as string ?? 'none'}
          onChange={(v) => onUpdate({ validation: v })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'email', label: 'Email' },
            { value: 'phone', label: 'Phone number' },
            { value: 'number', label: 'Number' },
          ]}
        />
      </Field>
    </>
  )
}

function LiveChatEditor({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (d: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Handoff Message">
        <textarea
          value={data.handoffMessage as string ?? ''}
          onChange={(e) => onUpdate({ handoffMessage: e.target.value })}
          placeholder="e.g. Connecting you to a live agent, please wait…"
          rows={3}
          className="w-full text-sm border rounded-md px-3 py-2 bg-background outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </Field>
      <Field label="Options">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data.notifyAgents as boolean ?? true}
            onChange={(e) => onUpdate({ notifyAgents: e.target.checked })}
            className="rounded"
          />
          Notify available agents in inbox
        </label>
      </Field>
    </>
  )
}

function WebhookEditor({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (d: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="URL">
        <Input value={data.url as string ?? ''} onChange={(v) => onUpdate({ url: v })} placeholder="https://your-server.com/webhook" />
      </Field>
      <Field label="Method">
        <Select
          value={data.method as string ?? 'POST'}
          onChange={(v) => onUpdate({ method: v })}
          options={[{ value: 'POST', label: 'POST' }, { value: 'GET', label: 'GET' }]}
        />
      </Field>
    </>
  )
}
