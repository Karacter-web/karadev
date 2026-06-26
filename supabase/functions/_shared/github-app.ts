// Shared GitHub App helpers — JWT minting + installation token + owner lookup.
import { SignJWT, importPKCS8 } from 'npm:jose@5';

const APP_ID = Deno.env.get('KARACTERHUB_GITHUB_APP_ID') ?? Deno.env.get('GITHUB_APP_ID');
const APP_PK = Deno.env.get('KARACTERHUB_GITHUB_APP_PRIVATE_KEY') ?? Deno.env.get('GITHUB_APP_PRIVATE_KEY');
const INSTALLATION_ID = Deno.env.get('KARACTERHUB_GITHUB_APP_INSTALLATION_ID') ?? Deno.env.get('GITHUB_APP_INSTALLATION_ID');

export async function mintAppJwt(): Promise<string> {
  if (!APP_ID || !APP_PK) throw new Error('GitHub App credentials missing (APP_ID / PRIVATE_KEY)');
  const pem = APP_PK.includes('\\n') ? APP_PK.replace(/\\n/g, '\n') : APP_PK;
  const key = await importPKCS8(pem, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({}).setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now - 60).setExpirationTime(now + 9 * 60).setIssuer(APP_ID).sign(key);
}

export async function getInstallationToken(): Promise<string> {
  if (!INSTALLATION_ID) throw new Error('GITHUB_APP_INSTALLATION_ID missing');
  const jwt = await mintAppJwt();
  const r = await fetch(`https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!r.ok) throw new Error(`Installation token: ${r.status} ${await r.text()}`);
  return (await r.json()).token as string;
}

export async function getInstallationOwner(): Promise<{ login: string; type: 'User' | 'Organization' }> {
  const jwt = await mintAppJwt();
  const r = await fetch(`https://api.github.com/app/installations/${INSTALLATION_ID}`, {
    headers: { 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/vnd.github+json' },
  });
  if (!r.ok) throw new Error(`Installation lookup: ${r.status}`);
  const j = await r.json();
  return { login: j.account.login, type: j.account.type };
}

export function ghHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'karadev-agent',
  };
}

import { createClient } from 'npm:@supabase/supabase-js@2';
export async function requireAdmin(req: Request) {
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw Object.assign(new Error('unauthorized'), { status: 401 });
  const { data: isAdmin } = await sb.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) throw Object.assign(new Error('forbidden'), { status: 403 });
  return user;
}