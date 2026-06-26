import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { getInstallationToken, getInstallationOwner, ghHeaders, requireAdmin } from '../_shared/github-app.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    await requireAdmin(req);
    const { name, description, private: isPrivate } = await req.json();
    if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) return j({ error: 'invalid repo name' }, 400);

    const token = await getInstallationToken();
    const owner = await getInstallationOwner();
    const url = owner.type === 'Organization'
      ? `https://api.github.com/orgs/${owner.login}/repos`
      : `https://api.github.com/user/repos`;
    const r = await fetch(url, {
      method: 'POST',
      headers: ghHeaders(token),
      body: JSON.stringify({ name, description: description ?? '', private: !!isPrivate, auto_init: true }),
    });
    if (!r.ok) return j({ error: `GitHub: ${r.status} ${await r.text()}` }, r.status);
    const repo = await r.json();
    return j({ repoUrl: repo.html_url, repoName: `${owner.login}/${repo.name}` });
  } catch (e: any) {
    return j({ error: e?.message ?? String(e) }, e?.status ?? 500);
  }
});