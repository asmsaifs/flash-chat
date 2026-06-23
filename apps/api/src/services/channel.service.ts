import { prisma } from '@flashchat/database'
import type { Contact } from '@flashchat/database'
import type { MessageContent } from '@flashchat/shared'
import { emitToConversation } from '../lib/socket.js'

export async function sendChannelMessage(
  channelId: string,
  contact: Contact,
  content: MessageContent
): Promise<void> {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })

  switch (channel.type) {
    case 'web_widget':
      // Emit via Socket.io — widget is browser-side
      emitToConversation(contact.id, 'message:receive', { content })
      break

    case 'telegram':
      await sendTelegramMessage(channel, contact, content)
      break

    case 'whatsapp':
      await sendWhatsAppMessage(channel, contact, content)
      break

    case 'messenger':
    case 'instagram':
      await sendMetaMessage(channel, contact, content)
      break
  }
}

async function sendTelegramMessage(channel: { credentials: unknown }, contact: Contact, content: MessageContent) {
  const { default: axios } = await import('axios')
  const creds = channel.credentials as { botToken: string }
  const chatId = contact.externalId

  if (!chatId) throw new Error('Contact has no external ID (Telegram chat_id)')

  const baseUrl = `https://api.telegram.org/bot${creds.botToken}`

  if (content.type === 'text') {
    await axios.post(`${baseUrl}/sendMessage`, { chat_id: chatId, text: content.text })
  } else if (content.type === 'image') {
    await axios.post(`${baseUrl}/sendPhoto`, { chat_id: chatId, photo: content.url, caption: content.caption })
  } else if (content.type === 'quick_replies') {
    await axios.post(`${baseUrl}/sendMessage`, {
      chat_id: chatId,
      text: content.text,
      reply_markup: {
        keyboard: [content.replies.map((r) => ({ text: r.label }))],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    })
  } else if (content.type === 'buttons') {
    await axios.post(`${baseUrl}/sendMessage`, {
      chat_id: chatId,
      text: content.text,
      reply_markup: {
        inline_keyboard: [content.buttons.map((b) => ({
          text: b.label,
          ...(b.url ? { url: b.url } : { callback_data: b.id }),
        }))],
      },
    })
  }
}

async function sendWhatsAppMessage(channel: { credentials: unknown }, contact: Contact, content: MessageContent) {
  const { default: axios } = await import('axios')
  const creds = channel.credentials as { phoneNumberId: string; accessToken: string }
  const to = contact.phone

  if (!to) throw new Error('Contact has no phone number for WhatsApp')

  const url = `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`
  const headers = { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' }

  if (content.type === 'text') {
    await axios.post(url, { messaging_product: 'whatsapp', to, type: 'text', text: { body: content.text } }, { headers })
  } else if (content.type === 'image') {
    await axios.post(url, { messaging_product: 'whatsapp', to, type: 'image', image: { link: content.url, caption: content.caption } }, { headers })
  } else if (content.type === 'buttons') {
    await axios.post(url, {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: content.text },
        action: {
          buttons: content.buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.label.slice(0, 20) },
          })),
        },
      },
    }, { headers })
  }
}

async function sendMetaMessage(channel: { credentials: unknown; type: string }, contact: Contact, content: MessageContent) {
  const { default: axios } = await import('axios')
  const creds = channel.credentials as { pageAccessToken: string; pageId: string }
  const recipientId = contact.externalId

  if (!recipientId) throw new Error('Contact has no external ID (Meta PSId)')

  const url = `https://graph.facebook.com/v21.0/${creds.pageId}/messages`
  const headers = { Authorization: `Bearer ${creds.pageAccessToken}` }

  if (content.type === 'text') {
    await axios.post(url, { recipient: { id: recipientId }, message: { text: content.text } }, { headers })
  } else if (content.type === 'quick_replies') {
    await axios.post(url, {
      recipient: { id: recipientId },
      message: {
        text: content.text,
        quick_replies: content.replies.map((r) => ({ content_type: 'text', title: r.label, payload: r.id })),
      },
    }, { headers })
  } else if (content.type === 'buttons') {
    await axios.post(url, {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: content.text,
            buttons: content.buttons.slice(0, 3).map((b) => ({
              type: b.url ? 'web_url' : 'postback',
              title: b.label,
              ...(b.url ? { url: b.url } : { payload: b.id }),
            })),
          },
        },
      },
    }, { headers })
  }
}
