# Architecture Overview

This document describes how Karadev is structured, how data flows, and why key decisions were made.

---

## System Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  React 18 + Vite + React Router v6 + Tailwind CSS           │
│  Supabase JS client (auth + data + realtime subscriptions)   │
└──────────────────────┬────────────────────────────────────────┘
                       │ HTTPS / WebSocket
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Platform                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Postgres  │  │  Edge Fn    │  │   Auth (GoTrue)     │  │
│  │  (RLS)      │  │  (Deno)     │  │  OAuth + Magic Link │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
│         │                │                                    │
│         └────────────────┘                                    │
│              Realtime (WebSocket)                             │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  Lovable AI Gateway  ──►  google/gemini-2.5-flash approach   │
│  GitHub API          ──►  repo browsing, file context        │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend

### Routing

React Router v6 handles all navigation. Routes are split into:

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | Public | Landing page |
| `/auth` | Public | Sign in / Sign up |
| `/auth/callback` | Public | OAuth callback handler |
| `/embed` | Token | Iframe-friendly chat widget |
| `/dashboard/*` | Protected | All app features |

`ProtectedRoute` guards dashboard routes with `useAuth`. `PublicRoute` redirects authenticated users away from `/auth`.

### State Management

- **Server state**: TanStack Query (`QueryClient`) for data fetching and caching.
- **Auth state**: `AuthContext` (React Context) wraps `supabase.auth.onAuthStateChange`.
- **UI state**: Local React state + shadcn/ui primitives (dialogs, toasts, sheets).

### Component Conventions

- All UI primitives live in `src/components/ui/` and are based on Radix UI + Tailwind.
- Page-level components live in `src/pages/` and are lazy-loaded in `App.tsx`.
- `DashboardLayout` wraps all protected routes and provides the sidebar navigation.

---

## Backend

### Database (Supabase Postgres)

**Row-Level Security (RLS)** is enabled on every table. Access rules use helper functions like `is_workspace_member()` and `is_workspace_admin()`.

Key tables:

| Table | Purpose |
|-------|---------|
| `workspaces` | Team containers with unique slugs |
| `workspace_members` | Role-based membership |
| `conversations` / `messages` | Chat threads with realtime |
| `tasks` | Workspace task tracking |
| `prompt_templates` | Reusable prompts with categories |
| `repositories` | Connected GitHub repos |
| `ai_audit_logs` | AI usage tracking (tokens, latency, model) |
| `api_keys` | Hashed workspace-scoped tokens |
| `daily_usage` | Per-user daily request cap enforcement |

### Edge Functions (Deno)

| Function | Purpose |
|----------|---------|
| `chat` | Main AI chat endpoint. Accepts Bearer JWT or `x-api-key`. Streams responses via SSE from Lovable AI Gateway. Enforces daily limits for JWT users. |
| `embed-exchange` | Validates workspace API keys and mints a temporary Supabase session for iframe embeds. |

### Auth Flow

1. **Google / GitHub OAuth**: `supabase.auth.signInWithOAuth` → redirect to provider → callback at `/auth/callback` → `onAuthStateChange` updates context.
2. **Email/Password**: `supabase.auth.signUp` / `signInWithPassword` with email redirect.
3. **API Key**: External apps send `x-api-key` header to edge functions. The key is hashed and looked up in `api_keys`.

---

## AI Integration

The `chat` edge function routes to **Lovable AI Gateway**:

```text
POST https://ai.gateway.lovable.dev/v1/chat/completions
Authorization: Lovable-API-Key <LOVABLE_API_KEY>
```

- **Primary model**: `google/gemini-2.5-flash`
- **Deep thinking**: When `think: true`, a separate non-streaming call generates an internal analysis, which is injected into the main streaming prompt.
- **Repository context**: If `repoContext` is provided, it is appended as a system message so the AI knows the codebase structure.
- **Streaming**: The function returns an SSE stream (`text/event-stream`) to the client.

---

## Realtime

Supabase Realtime is enabled on the `messages` table:

1. Client opens a channel on `messages` filtered by `conversation_id`.
2. New inserts from other users trigger the subscription.
3. The client appends the new message to local state without refetching.

---

## VS Code Extension

The `vscode-extension/` folder is a self-contained Node project:

- **Auth**: Email/password against Supabase Auth; tokens stored in `SecretStorage`.
- **Chat**: Two entry points — a panel (`ViewColumn.Beside`) and a sidebar view (`WebviewViewProvider`). Both share the same streaming logic.
- **Context**: `getEditorContext()` captures the current selection or full document and sends it as a prefill message.
- **Build**: esbuild bundles to `out/`. Zero runtime npm dependencies.

---

## Deployment

### Vercel

- **Build command**: `vite build`
- **Output directory**: `dist`
- **Environment variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

### Security Headers (`vercel.json`)

- Strict-Transport-Security (HSTS)
- Content-Security-Policy (CSP) restricting `connect-src` to Supabase, Lovable AI, and dev domains
- X-Frame-Options, X-Content-Type-Options, Referrer-Policy

---

## Data Flow Example: Sending a Chat Message

```text
1. User types message in Chat.tsx
2. Client inserts into messages table via Supabase client
3. Realtime broadcasts the insert to all subscribers
4. Client streams AI response:
   a. POST to /functions/v1/chat with Bearer token or x-api-key
   b. Edge function validates auth + daily limit
   c. Edge function calls Lovable AI Gateway (SSE stream)
   d. Tokens are streamed back to the client
   e. Client appends assistant message to the conversation
5. ai_audit_logs records tokens, latency, and model used
```

---

## Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| React Router v6 (not Next.js) | SPA on Vercel avoids server runtime complexity; static deploy is faster and cheaper. |
| Supabase over custom backend | Built-in auth, realtime, and Postgres RLS reduce backend code significantly. |
| Edge functions over traditional API | Colocated with the database; low latency; Deno runtime is sufficient for stateless AI proxying. |
| Lovable AI Gateway over direct OpenRouter | Centralized billing and key rotation; easier to switch models later. |
| No Zod / no heavy validation libs | Keeps bundle small; edge function input is simple and validated manually. |
| API keys bypass daily limits | Designed for integrations — scripts and CI should not hit per-user caps. |
