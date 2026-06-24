# Build Agent — Setup

The admin **Build Agent** at `/admin/agent` chains three edge functions:

| Stage | Function | Model | Required secret(s) |
|---|---|---|---|
| Analyze prompt + optional source repo/URL | `agent-analyze` | Mistral 7B Instruct (via Hugging Face) | `HUGGINGFACE_TOKEN` |
| Generate full project file tree | `agent-scaffold` | DeepSeek Coder | `DEEPSEEK_API_KEY` |
| Create GitHub repo + push initial commit | `agent-deploy` | — | `KARACTERHUB_GITHUB_APP_ID`, `KARACTERHUB_GITHUB_APP_PRIVATE_KEY`, `KARACTERHUB_GITHUB_APP_INSTALLATION_ID` |

All five secrets live in **Supabase → Project Settings → Edge Functions → Secrets**.

---

## 1. DeepSeek

1. Create an account at <https://platform.deepseek.com>.
2. Generate an API key under **API Keys**.
3. Save as `DEEPSEEK_API_KEY`.

## 2. Hugging Face (Mistral)

1. Sign in at <https://huggingface.co/settings/tokens>.
2. Create a **Read** token (Inference API enabled).
3. Save as `HUGGINGFACE_TOKEN`.

## 3. Karacterhub GitHub App

The deploy step authenticates as a GitHub App installation (no personal tokens, no user OAuth).

### Create the app

1. Go to <https://github.com/settings/apps/new> (or your org's app settings).
2. **Name**: `Karacterhub Deployer` (or similar).
3. **Homepage URL**: any.
4. **Webhook**: uncheck "Active" (not needed).
5. **Repository permissions**:
   - **Administration**: Read & write (to create repos)
   - **Contents**: Read & write (to push files)
   - **Metadata**: Read-only (auto)
6. **Organization permissions** (only if installing on an org):
   - **Members**: Read-only
7. **Where can this GitHub App be installed?** → "Only on this account" (or "Any account").
8. Create the app.

### Collect credentials

- **App ID**: shown on the app's settings page → save as `KARACTERHUB_GITHUB_APP_ID`.
- **Private key**: click **Generate a private key** → download the `.pem` file. Open it and copy the entire contents (including `-----BEGIN/END-----` lines). Save as `KARACTERHUB_GITHUB_APP_PRIVATE_KEY`.
  - Either paste the raw multiline PEM, or paste it with `\n` for newlines — the function handles both.

### Install the app

1. From the app settings, click **Install App**.
2. Choose the **karacterhub** organization (or the user account you want to host generated repos under).
3. Grant access to **All repositories** (so the app can create new ones).
4. After install, copy the **Installation ID** from the URL: `https://github.com/settings/installations/<INSTALLATION_ID>`.
5. Save as `KARACTERHUB_GITHUB_APP_INSTALLATION_ID`.

---

## 4. Verify

After all five secrets are saved, the three edge functions redeploy automatically. Then:

1. Sign in as `admin@karacterhub.xyz`.
2. Navigate to **Admin Panel → Build Agent**.
3. Enter a prompt like *"Build a small HRM app with employee CRUD and a React + Express stack"* and click **Run agent**.
4. Watch the stage indicator: Analyzing → Scaffolding → Deploying.
5. On success, a link to the new repo on github.com/karacterhub appears.

## Troubleshooting

- **`Installation token: 401`** → wrong `KARACTERHUB_GITHUB_APP_ID` or `KARACTERHUB_GITHUB_APP_PRIVATE_KEY` (most often a corrupted PEM — re-download the `.pem` and paste it intact).
- **`Create repo: 403`** → the app doesn't have **Administration: write** permission, or it's installed only on a single repo instead of "All repositories". Re-grant access from the org's Installed Apps page.
- **`DeepSeek 401`** → `DEEPSEEK_API_KEY` invalid or out of credits.
- **`Mistral/HF 503`** → HF cold-start; retry in 30s. If it persists, the model may be loading or rate-limited on the free tier.
- **Model returned no files** → DeepSeek failed to produce valid JSON; usually a too-vague prompt. Re-run with a more specific brief.