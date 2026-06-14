# Karadev — AI Coding Assistant for VS Code

Chat with **Karacter**, your Karadev AI teammate, directly from VS Code.
Streams answers from your own Supabase project's `chat` edge function — the
same one the Karadev web app uses, so your daily limits and history rules
still apply.

## Setup (one-time)

1. Install the extension (`.vsix` via *Extensions → … → Install from VSIX*).
2. Open VS Code settings and set **`karadev.supabaseUrl`** to your Supabase
   project URL (e.g. `https://xxxx.supabase.co`).
3. Run **`Karadev: Sign In`** from the command palette.
4. Enter your email and password (same credentials as the Karadev web app).
5. On first sign-in, paste your Supabase **anon / public** key when
   prompted. Find it in *Supabase dashboard → Project Settings → API →
   `anon` `public` key*. It is stored in VS Code's encrypted secret
   storage and never written to disk in plain text.

## How it connects

The extension calls `/functions/v1/chat` on your Supabase project directly.
It uses the same OpenRouter-powered edge function as the Karadev web app.
Your daily message limits apply across both the web app and the extension.

## Commands

| Command | Default keybinding |
| --- | --- |
| Karadev: Open Chat | `Ctrl/Cmd+Shift+K` |
| Karadev: Ask About Selected Code | `Ctrl/Cmd+Shift+A` |
| Karadev: Explain Selected Code | — |
| Karadev: Fix Selected Code | — |
| Karadev: Sign In / Sign Out | — |
| Karadev: Clear Conversation | — |

The selection commands also appear in the editor right-click menu.

## Build from source

```bash
npm install
npm run compile     # esbuild bundle to out/extension.js
npm run package     # produces karadev-<version>.vsix
```

No runtime npm dependencies — Node 18+ built-in `fetch` is used for
streaming.