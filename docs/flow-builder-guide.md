# FlashChat Flow Builder — User Guide

Flows let you automate conversations — greeting visitors, collecting information, routing to AI or a human agent — without writing any code. This guide walks you through every node type, how to connect them, and how to publish a working flow.

---

## Table of Contents

1. [What is a Flow?](#1-what-is-a-flow)
2. [Opening the Flow Builder](#2-opening-the-flow-builder)
3. [Canvas Basics](#3-canvas-basics)
4. [Node Types](#4-node-types)
   - [Trigger](#41-trigger)
   - [Message](#42-message)
   - [User Input](#43-user-input)
   - [AI Reply](#44-ai-reply)
   - [Condition](#45-condition)
   - [Action](#46-action)
   - [Delay](#47-delay)
   - [Live Chat](#48-live-chat)
   - [Webhook](#49-webhook)
5. [Connecting Nodes](#5-connecting-nodes)
6. [Using Variables](#6-using-variables)
7. [Publishing a Flow](#7-publishing-a-flow)
8. [Example Flows](#8-example-flows)
9. [Tips & Common Mistakes](#9-tips--common-mistakes)

---

## 1. What is a Flow?

A **flow** is a sequence of steps that runs automatically when a visitor starts a conversation. You define:

- **When** it starts (the Trigger)
- **What it says** (Message nodes)
- **What it asks** (User Input nodes)
- **How it decides** what to do next (Condition nodes)
- **Whether to hand off** to a human (Live Chat node)

Flows run top-to-bottom, branching left or right at decision points, until they reach an end or hand off to a human agent.

---

## 2. Opening the Flow Builder

1. Go to **Dashboard → Flows** in the sidebar.
2. Click **New Flow** or open an existing one.
3. The canvas opens with an empty board and a node palette on the left.

---

## 3. Canvas Basics

| Action | How |
|---|---|
| **Add a node** | Drag a node type from the left panel onto the canvas |
| **Move a node** | Click and drag it |
| **Select a node** | Click it — a settings panel opens on the right |
| **Delete a node** | Click the node to select it, then press `Delete` or `Backspace` — or click the **trash icon** in the top-right corner of the settings panel (next to the X close button) |
| **Connect two nodes** | Drag from the **dot at the bottom** of one node to the **dot at the top** of another |
| **Delete a connection** | Click the connection line and press Delete |
| **Zoom / pan** | Scroll to zoom, click-drag empty space to pan |

> **Important:** Every node must be connected to the next. Disconnected nodes are skipped.

---

## 4. Node Types

### 4.1 Trigger

> **What it does:** Starts the flow. Every flow must begin with exactly one Trigger node.

**Settings:**

| Setting | Options | Description |
|---|---|---|
| **Trigger Type** | First Message | Fires when a visitor opens a new conversation |
| | Keyword Match | Fires when the visitor's message contains a specific word |
| | Opt-in | Fires when a contact subscribes |
| | Button Click | Fires when a button in a previous message is clicked |
| **Keyword** | *(text)* | Only shown for Keyword Match — the word or phrase to listen for |
| **Channel** | All Channels, Web Widget, WhatsApp, Telegram, Messenger, Instagram | Limit this flow to one channel, or leave as "All Channels" |

**Example:** Set Trigger Type to `First Message` and Channel to `Web Widget` to greet every new web visitor automatically.

---

### 4.2 Message

> **What it does:** Sends a message from your bot to the visitor. No response is expected — the flow continues immediately.

**Settings:**

| Setting | Options | Description |
|---|---|---|
| **Message Type** | Text | Plain text message |
| | Image | An image URL |
| | Quick Replies | Text with tap-able reply buttons |
| | Buttons | Text with action buttons |
| **Text** | *(text area)* | The message content. Supports [variables](#6-using-variables) like `{{name}}` |

**Use for:** Greetings, confirmations, closing messages, instructions.

**Example:**
```
👋 Hi there! Welcome to support. I'm here to help you today.
```

---

### 4.3 User Input

> **What it does:** Sends a question and **waits** for the visitor to reply. The flow is paused until they respond.

**Settings:**

| Setting | Options | Description |
|---|---|---|
| **Prompt** | *(text area)* | The question to ask the visitor |
| **Save to Variable** | *(text)* | The variable name to store their answer in (e.g. `name`, `email`, `issue`) |
| **Validation** | None | Accept any text |
| | Email | Only accept a valid email address |
| | Phone Number | Only accept a valid phone number |
| | Number | Only accept a numeric value |

**Use for:** Collecting name, email, order number, describing their issue.

**Example:**
- Prompt: `What's your name so I can address you properly?`
- Save to Variable: `name`

After this node, `{{name}}` can be used in any Message node to greet them personally.

---

### 4.4 AI Reply

> **What it does:** Generates an intelligent reply based on the conversation history and your knowledge base. Uses AI to understand the visitor's question and respond appropriately.

**Settings:**

| Setting | Description |
|---|---|
| **Fallback to human agent if confidence < 50%** | If the AI is not confident in its answer, the conversation is automatically escalated to a live agent instead of sending a potentially wrong reply |

**How it works:**
1. The AI reads the last several messages in the conversation.
2. It searches your knowledge base for relevant answers.
3. It generates a reply and scores its own confidence (0–100%).
4. If confidence is below 50% and Fallback is enabled, it routes to a human instead.
5. After replying, it also scores the **sentiment** of the visitor's last message (`positive`, `neutral`, `negative`, or `urgent`). This sentiment is available to a Condition node immediately after.

**Use for:** Answering questions automatically using your product documentation or FAQ.

---

### 4.5 Condition

> **What it does:** Checks a value and splits the flow into two paths — **Yes** (green, left) and **No** (red, right).

**Settings:**

| Setting | Description |
|---|---|
| **Field** | What to check. See field options below. |
| **Operator** | How to compare the value |
| **Value** | What to compare against |

**Field options:**

| Field value | What it checks |
|---|---|
| `sentiment` | The AI's sentiment score from the previous AI Reply node (`positive`, `neutral`, `negative`, `urgent`) |
| `tag:tagname` | Whether the contact has a specific tag (e.g. `tag:vip`) |
| *(any other name)* | A contact custom field (e.g. `name`, `email`, `plan`) |

**Operator options:**

| Operator | Meaning |
|---|---|
| `equals` | Exact match |
| `not equals` | Does not match |
| `contains` | Field value contains the given text |
| `greater than` | Numeric comparison |
| `less than` | Numeric comparison |
| `is true` | Boolean field is true |

**Connecting the outputs:**

The Condition node has **two output handles** at the bottom:
- **Yes (green, left)** — connect to the next step when the condition is true
- **No (red, right)** — connect to the next step when the condition is false

You must connect **both** handles, otherwise one branch will dead-end.

**Example — escalate urgent visitors:**
- Field: `sentiment`
- Operator: `equals`
- Value: `urgent`
- Yes → Live Chat node (escalate)
- No → Message node ("Hope that helped!")

---

### 4.6 Action

> **What it does:** Performs a silent action on the contact record — no message is sent to the visitor.

**Settings:**

| Action Type | Additional Fields | Description |
|---|---|---|
| **Add Tag** | Tag name | Adds a label to the contact (e.g. `vip`, `needs-followup`) |
| **Remove Tag** | Tag name | Removes a label from the contact |
| **Set Custom Field** | Field name + Value | Stores a value on the contact (e.g. set `plan` to `pro`) |

**Use for:** Marking contacts for segmentation, updating their record based on what they answered, setting up triggers for future flows.

---

### 4.7 Delay

> **What it does:** Pauses the flow for a set number of seconds before moving to the next node.

**Settings:**

| Setting | Description |
|---|---|
| **Delay (seconds)** | How many seconds to wait (max 30 seconds in current version) |

**Use for:** Creating a natural typing pause between messages, spacing out a sequence of messages so they don't all arrive at once.

---

### 4.8 Live Chat

> **What it does:** Ends the automated flow and hands the conversation to a human agent. Agents in the Inbox will be notified.

**Settings:**

| Setting | Description |
|---|---|
| **Handoff Message** | Optional message sent to the visitor while they wait (e.g. "Connecting you to a live agent, please wait…") |
| **Notify available agents** | Sends an alert to agents in the Inbox |

**Use for:** Escalating complex or urgent issues, requests for refunds, anything the AI cannot handle confidently.

> Once a Live Chat node is reached, the flow stops. A human agent takes over from the Inbox.

---

### 4.9 Webhook

> **What it does:** Sends conversation data to an external URL (your own server or a third-party service like Zapier or Make).

**Settings:**

| Setting | Description |
|---|---|
| **URL** | The endpoint to call (must be publicly accessible) |
| **Method** | `POST` (default) or `GET` |

**Payload sent:**
```json
{
  "contactId": "...",
  "conversationId": "...",
  "variables": { "name": "Saif", "issue": "..." }
}
```

**Use for:** Creating a CRM record, triggering a Zap, logging to a spreadsheet, sending a Slack notification.

---

## 5. Connecting Nodes

Every node (except Live Chat and the final Message) needs a connection going out:

1. Hover over a node — a **dot appears at the bottom**.
2. Click and drag from that dot to the **top of the next node**.
3. A line appears connecting them.

**Condition nodes have two outputs** — make sure you connect both the Yes (green) and No (red) handles.

**Rules:**
- One flow = one Trigger at the top
- Every path must end at either a Message, Live Chat, or Webhook node
- Unconnected nodes are ignored when the flow runs

---

## 6. Using Variables

Variables let you personalise messages using information collected from the visitor.

**Syntax:** `{{variableName}}`

**How to use:**
1. Collect data with a User Input node — set "Save to Variable" to e.g. `name`
2. In any Message node after that, write `{{name}}` — it will be replaced with what the visitor typed

**Built-in variables:**

| Variable | Value |
|---|---|
| `{{name}}` | Visitor's captured name |
| `{{email}}` | Visitor's captured email |
| `{{issue}}` | Visitor's captured issue description |

Any field you collect with a User Input node becomes available as `{{fieldName}}`.

**Example message:**
```
Thanks {{name}}! I've looked into your issue and here's what I found…
```

---

## 7. Publishing a Flow

A flow must be **published** before it runs for real visitors.

1. Build and connect all your nodes on the canvas.
2. Click **Save** to save your draft.
3. Click **Publish** to make it live.

> **Unpublished flows** are drafts — they do not run for visitors.
> **Only one flow per trigger type** (e.g. one "First Message" flow) can be active per channel at a time.

To disable a flow without deleting it, click **Unpublish**.

---

## 8. Example Flows

### Basic Support Flow

```
[Trigger: First Message]
        ↓
[Message: "👋 Hi! Welcome to support."]
        ↓
[User Input: "What's your name?" → saves to: name]
        ↓
[User Input: "What can I help you with today?" → saves to: issue]
        ↓
[AI Reply: fallback to human if low confidence]
        ↓
[Condition: sentiment = urgent]
    Yes ↓                   No ↓
[Live Chat]          [Message: "✅ Hope that helped!"]
```

### Keyword Escalation Flow

```
[Trigger: Keyword = "refund"]
        ↓
[Message: "I'll connect you with our billing team right away."]
        ↓
[Live Chat: notify agents]
```

### Lead Collection Flow

```
[Trigger: First Message]
        ↓
[Message: "👋 Hi! Before I help, let me grab a few details."]
        ↓
[User Input: "What's your email?" → saves to: email, validation: Email]
        ↓
[Action: Add Tag → "lead"]
        ↓
[Message: "Thanks! One of our team will reach out to {{email}} shortly."]
```

---

## 9. Tips & Common Mistakes

**✅ Do:**
- Always connect **both branches** of a Condition node
- Place an **AI Reply** node before a **Condition** node when checking `sentiment`
- Use **Delay** nodes between rapid messages so they feel natural
- Test with the widget by clicking "New Session" after saving

**❌ Avoid:**
- Leaving nodes disconnected — they will be silently skipped
- Checking `sentiment` without an AI Reply node directly before it — sentiment will be empty
- Putting a Message node as the only step after a condition — remember to connect both Yes and No paths
- Publishing a flow while another flow with the same trigger is already active on the same channel

**Condition node: both paths must be connected**

```
          [Condition]
         ↙           ↘
  [Live Chat]    ← don't leave this empty
```

If you only connect one side, visitors taking the other path will get no response and the flow will silently end.
