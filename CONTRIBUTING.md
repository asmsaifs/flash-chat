# Contributing to FlashChat

Thanks for taking the time to contribute. This guide covers everything you need to get a change merged.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Workflow](#workflow)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Coding Standards](#coding-standards)
- [Project Structure](#project-structure)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to abide by its terms.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/flashchat.git`
3. Add the upstream remote: `git remote add upstream https://github.com/asmsaifs/flashchat.git`
4. Follow the [Development Setup](#development-setup) steps below

## Development Setup

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL with `pgvector` extension
- Redis

### Install

```bash
pnpm install
```

### Configure environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill in all required values. At minimum you need:
- A Clerk account (free tier works)
- A PostgreSQL connection with `pgvector` enabled
- A Redis connection
- An OpenRouter API key

### Run migrations and start

```bash
pnpm --filter @flashchat/database db:migrate
pnpm dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## Workflow

1. Sync with upstream before starting: `git fetch upstream && git rebase upstream/main`
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run checks: `pnpm typecheck && pnpm lint`
5. Commit following the [commit message convention](#commit-messages)
6. Push to your fork and open a pull request against `main`

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body — explain WHY, not WHAT]
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`

**Scopes** (optional): `api`, `web`, `db`, `shared`, `billing`, `flows`, `inbox`, `channels`, `analytics`

**Examples:**

```
feat(flows): add AI node type to flow builder
fix(api): correct token expiry check in auth middleware
docs: update widget embed instructions in README
```

- Subject line ≤ 72 characters
- Use imperative mood ("add", not "added" or "adds")
- No period at end of subject line

## Pull Requests

- One logical change per PR — keep scope focused
- Fill in the PR template (title, summary, test plan)
- All checks must pass: TypeScript, lint
- Link any related issues with `Closes #123` or `Fixes #123`
- Request a review — do not merge your own PRs without review

### PR title format

Same as commit message subject: `<type>(<scope>): <short summary>`

## Coding Standards

### TypeScript

- Strict mode is enabled — no `any` without justification
- Prefer explicit return types on exported functions
- Use Zod schemas from `packages/shared` for all request validation

### API (Fastify)

- All routes must go behind `authMiddleware` unless explicitly public
- Use `plan-limits` middleware on routes that consume metered resources
- Return consistent error shapes: `{ error: string }`

### Frontend (Next.js)

- Use TanStack Query for all server state — no manual `fetch` in components
- Use shadcn/ui primitives before writing custom components
- Keep page components thin — extract logic into hooks under `src/hooks/`

### Database (Prisma)

- Never write raw SQL unless `pgvector` operations require it
- All schema changes need a migration: `pnpm --filter @flashchat/database db:migrate`
- Regenerate client after schema changes: `pnpm db:generate`

### General

- No `console.log` left in production code paths
- No commented-out code committed
- Comments only when the WHY is non-obvious

## Project Structure

```
apps/api/src/
├── lib/          # Singletons (prisma, redis, stripe, socket)
├── middleware/   # Auth, plan limits
├── routes/       # Route handlers (one file per domain)
├── services/     # Business logic
├── webhooks/     # Stripe, channel webhooks
└── workers/      # BullMQ workers

apps/web/src/
├── app/          # Next.js App Router pages
├── components/   # Shared UI components
└── hooks/        # Custom React hooks
```

## Reporting Bugs

Open an issue and include:

1. What you did
2. What you expected to happen
3. What actually happened
4. Steps to reproduce
5. Environment (OS, Node version, browser if frontend)

Attach logs or screenshots where relevant.

## Suggesting Features

Open an issue tagged `enhancement`. Describe:

1. The problem you want to solve
2. Your proposed solution
3. Alternatives you considered

For large changes, open an issue first to discuss before investing in implementation.
