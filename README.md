# FlashChat

AI-powered chat marketing platform. Multi-channel inbox, visual flow builder, broadcast campaigns, and OpenRouter AI — built as a ManyChat alternative.

## Features

- **Multi-channel inbox** — Web Widget, WhatsApp, Telegram, Facebook Messenger, Instagram DM
- **Visual flow builder** — drag-and-drop automation with React Flow; trigger, message, condition, delay, user-input, live-chat, and AI nodes
- **Broadcast campaigns** — scheduled bulk messaging with per-contact variable substitution
- **AI reply suggestions** — RAG-powered suggestions via OpenRouter (default: `anthropic/claude-sonnet-4-6`, swappable per workspace)
- **Contacts** — tag filtering, CSV import, subscribe/unsubscribe, custom fields
- **Analytics** — message volume (30-day), channel breakdown, subscriber growth

## Tech Stack

| Layer | Tech |
|---|---|
| Monorepo | Turborepo + pnpm |
| Frontend | Next.js 15, Tailwind, shadcn/ui, React Flow, TanStack Query, Recharts |
| Backend | Fastify, Prisma, BullMQ, Socket.io |
| Database | PostgreSQL (pgvector extension) |
| Cache / Queue | Redis (ioredis) |
| Auth | Clerk |
| AI | OpenRouter (OpenAI-compatible) |
| Payments | Stripe |

## Project Structure

```
flashchat/
├── apps/
│   ├── api/          # Fastify API server
│   └── web/          # Next.js frontend
├── packages/
│   ├── database/     # Prisma schema + migrations
│   └── shared/       # Shared TypeScript types, Zod schemas, constants
├── docker-compose.yml
└── turbo.json
```

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL with `pgvector` extension
- Redis

### Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd flashchat
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

   Fill in all required values (see `.env.example` files for reference).

3. **Run database migrations**

   ```bash
   pnpm --filter @flashchat/database db:migrate
   ```

4. **Start development servers**

   ```bash
   pnpm dev
   ```

   - Web: `http://localhost:3000`
   - API: `http://localhost:4000`

### Web Widget Embed

Get the embed code from the Channels page in your dashboard, or use:

```html
<script
  src="http://localhost:3000/widget.js"
  data-channel="<channelId>"
  data-api="http://localhost:4000"
></script>
```

## Environment Variables

### API (`apps/api/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `CLERK_SECRET_KEY` | Clerk backend secret |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe price ID for Pro plan |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | Stripe price ID for Business plan |
| `STRIPE_PRICE_AGENCY_MONTHLY` | Stripe price ID for Agency plan |
| `SUPER_ADMIN_USER_IDS` | Comma-separated Clerk user IDs for super admin access |

### Web (`apps/web/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk backend secret |
| `NEXT_PUBLIC_API_URL` | API base URL |
| `NEXT_PUBLIC_SUPER_ADMIN_USER_IDS` | Comma-separated Clerk user IDs for admin UI |

## Available Scripts

```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all apps
pnpm typecheck    # TypeScript check across monorepo
pnpm lint         # Lint all packages
pnpm db:migrate   # Run Prisma migrations
pnpm db:seed      # Seed database
pnpm db:generate  # Regenerate Prisma client
pnpm format       # Format all files with Prettier
```

## License

Apache 2.0 — see [LICENSE](LICENSE).
