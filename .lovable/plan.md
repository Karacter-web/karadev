
# Plan: scaffold `vscode-karadev` as a standalone subfolder

All files land under `vscode-karadev/` at the project root. The existing TanStack web app is not touched. The folder is self-contained — you can copy it out into its own git repo and run `npm install && npm run package` to produce a `.vsix`.

## Folder layout

```text
vscode-karadev/
├── package.json
├── tsconfig.json
├── .vscodeignore
├── .gitignore
├── README.md
├── CHANGELOG.md
├── media/
│   ├── icon.png            (128x128, generated)
│   ├── sidebar-icon.svg    (24x24 monochrome)
│   └── chat.css            (webview styles, VS Code tokens only)
└── src/
    ├── extension.ts        activate/deactivate, status bar, wiring
    ├── auth.ts             KaradevAuthManager (email+password, refresh, SecretStorage)
    ├── chat-panel.ts       KaradevChatPanel (WebviewPanel, singleton, SSE streaming)
    ├── sidebar-provider.ts KaradevSidebarProvider (WebviewViewProvider, independent convo)
    ├── commands.ts         ask/explain/fix selection, signIn/Out, clear, openChat
    ├── context.ts          getEditorContext, buildRepoContext
    ├── types.ts            ChatMessage, EditorContext, KaradevSession
    └── webview.ts          getWebviewHtml(webview, extensionUri, nonce) — shared HTML
```

## What each file contains

**package.json** — exact metadata, commands, menus, keybindings, configuration, viewContainer + view, activation `onStartupFinished`, devDeps only (`@types/vscode`, `@types/node`, `typescript`, `@vscode/vsce`, `esbuild`), scripts (`compile`/`watch`/`package`/`vscode:prepublish`) using esbuild bundling.

**tsconfig.json** — `target: ES2022`, `module: commonjs`, `strict: true`, `outDir: out`, `lib: [ES2022]`, `rootDir: src`.

**auth.ts** — `KaradevAuthManager` class with `EventEmitter`-backed `onSessionChange`. Prompts for `supabaseUrl` (settings), anon key (SecretStorage key `karadev.anonKey`), email, password (masked). POSTs to `/auth/v1/token?grant_type=password`, stores `{accessToken, refreshToken, email, userId, expiresAt}` at `karadev.session`. `ensureFreshSession()` refreshes within 5 min of expiry via `grant_type=refresh_token`.

**chat-panel.ts** — `KaradevChatPanel.createOrShow(context, auth)` singleton, `ViewColumn.Beside`, `retainContextWhenHidden: true`. Holds in-memory `ChatMessage[]`. `sendUserMessage(text, think)`: appends message, posts to `{supabaseUrl}/functions/v1/chat` with bearer token, reads `response.body.getReader()`, parses SSE (`data: ` lines, skip `[DONE]`, extract `choices[0].delta.content`), forwards `token` events to webview. Handles 402 / 429 with structured error events. Posts the full message protocol listed in the spec.

**sidebar-provider.ts** — `KaradevSidebarProvider implements vscode.WebviewViewProvider` for view id `karadev.chatView`. Reuses `getWebviewHtml` and the same send/stream pipeline as the panel, but maintains its own messages array — fully independent conversation.

**commands.ts** — registers all `karadev.*` commands. `ask/explain/fix` build the prefill string from `getEditorContext`, open the chat panel, then post `{type: "prefill", text}` to the webview.

**context.ts** — `getEditorContext()` returns selection if any else full document, with `lineRange` like `L10-24`. `buildRepoContext(config)` honors `karadev.includeFileContext`.

**types.ts** — interfaces exactly as specified.

**webview.ts** — `getWebviewHtml` returns the full HTML with strict CSP (`connect-src https://*.supabase.co https://openrouter.ai`), nonce on script/style, loads `media/chat.css` via `webview.asWebviewUri`. Inline script implements: message protocol both ways, simple markdown renderer (bold/italic/inline code/fenced code with Copy button + language label), typing dots, auto-resize textarea (max 120px), Enter-to-send / Shift+Enter newline, Deep thinking checkbox, char counter >500, empty state, dismissible error banner, header with email + clear button.

**media/chat.css** — only `var(--vscode-*)` tokens; user bubbles right-aligned with `--vscode-badge-background`, assistant bubbles left with `--vscode-editor-inactiveSelectionBackground`, code blocks with `--vscode-textCodeBlock-background`, etc.

**extension.ts** — `activate(context)`:
1. Build `KaradevAuthManager`.
2. Register `KaradevSidebarProvider` for `karadev.chatView`.
3. Register all commands from `commands.ts`.
4. Create status bar item (Right, priority 100). Update on `onSessionChange`: signed-in shows `$(robot) Karacter` → `karadev.openChat`; signed-out shows `$(robot) Sign in to Karadev` with warning background → `karadev.signIn`.
5. Push everything into `context.subscriptions`.

**media/icon.png** — generated via imagegen (premium tier off; fast 128x128 robot/code themed icon, solid background).
**media/sidebar-icon.svg** — small hand-written 24x24 monochrome SVG using `currentColor` so VS Code themes it.

**README.md / CHANGELOG.md** — README contains the Setup and "How it connects" sections from the spec verbatim plus install/build instructions. CHANGELOG seeded with `0.1.0 - Initial release`.

**.vscodeignore / .gitignore** — exclude `src/`, `node_modules/`, `out/*.map`, `*.vsix`, tsconfig, etc. from the vsix; standard Node `.gitignore`.

## Verification

After scaffolding, I'll run `cd vscode-karadev && npm install && npm run compile` to confirm a clean esbuild bundle. I will NOT run `vsce package` (it needs git context and a publisher token), but the script is wired so you can run it locally.

## Constraints I will honor

- Zero runtime npm deps (Node 18 fetch + SSE via WHATWG streams).
- esbuild only, no webpack.
- No hardcoded URLs / project IDs / keys.
- Email+password only; no OAuth.
- All secrets via `context.secrets`; nothing in `globalState` for tokens.
- Webview styled with VS Code CSS variables exclusively.
- The existing TanStack project files are untouched.
