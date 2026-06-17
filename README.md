# Karadev

**AI-powered collaborative development platform for developer teams.**

Karadev is a real-time workspace where teams connect repositories, collaborate with an AI assistant, manage tasks, and ship code faster — all in one place.

---

## Live URL

- **Production**: https://dev.karacterhub.xyz
- **Vercel**: https://karadev-delta.vercel.app

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind CSS v3 |
| Routing | React Router v6 |
| State | React Query (TanStack Query) |
| Backend | Supabase (Postgres + Edge Functions) |
| Auth | Supabase Auth (Google OAuth, GitHub OAuth, Email/Password) |
| AI | Lovable AI Gateway (Gemini Flash) |
| Extension | VS Code extension (TypeScript, esbuild) |
| Deploy | Vercel |

---

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Create .env from the example below

# 3. Run the dev server
bun run dev
```

### Environment Variables

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

> Edge functions also need `LOVABLE_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in Supabase secrets.

---

## Project Structure

```text
src/
  pages/           Route-level pages (Dashboard, Chat, Settings, etc.)
  components/      Reusable UI components (shadcn/ui based)
  hooks/           Custom React hooks (useAuth, use-toast)
  integrations/    Supabase client + types
  lib/             Utilities (github-token, cn helper)
supabase/
  functions/       Edge Functions (chat, embed-exchange)
  migrations/      Database schema migrations
vscode-extension/  VS Code extension source
public/            Static assets
```

---

## Key Features

- **Multi-workspace collaboration** — create or join workspaces, invite team members
- **AI chat** — real-time streaming chat with repository-aware context and deep-thinking mode
- **GitHub integration** — connect repos, browse files, and reference code in chat
- **Task management** — assign, track, and complete tasks per workspace
- **Prompt library** — reusable prompt templates with category filters
- **Audit logs** — track AI usage, tokens, and latency per workspace
- **API keys** — generate workspace-scoped API keys for external integrations
- **Embed mode** — iframe-friendly chat widget via `/embed` with token exchange
- **VS Code extension** — chat with Karacter directly from your editor

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server |
| `bun run build` | Production build |
| `bun run lint` | ESLint check |

### VS Code Extension

```bash
cd vscode-extension
npm install
npm run compile      # esbuild bundle
npm run package      # Produce .vsix
```

---

## Database Schema (High-level)

- `workspaces` — team workspaces with slug
- `workspace_members` — role-based membership (admin, member)
- `conversations` / `messages` — chat threads with realtime subscriptions
- `tasks` — workspace tasks with assignees
- `prompt_templates` — reusable prompts with categories
- `repositories` — connected GitHub repos
- `ai_audit_logs` — AI usage tracking per workspace
- `api_keys` — hashed workspace API tokens
- `daily_usage` — per-user daily request limits

See `supabase/migrations/` for the full schema.

---

## License

MIT — see [LICENSE](./LICENSE).

## Contributing

See [COLLABORATION.md](./COLLABORATION.md) and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
