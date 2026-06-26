import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { getInstallationToken, ghHeaders, requireAdmin } from '../_shared/github-app.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    await requireAdmin(req);
    const token = await getInstallationToken();
    const repos: any[] = [];
    let page = 1;
    while (page <= 5) {
      const r = await fetch(`https://api.github.com/installation/repositories?per_page=100&page=${page}`, { headers: ghHeaders(token) });
      if (!r.ok) return j({ error: `GitHub: ${r.status} ${await r.text()}` }, r.status);
      const data = await r.json();
      const batch = data.repositories ?? [];
      repos.push(...batch);
      if (batch.length < 100) break;
      page++;
    }
    return j({
      repos: repos.map((x: any) => ({
        name: x.full_name, url: x.html_url, private: x.private, description: x.description,
        default_branch: x.default_branch, updated_at: x.updated_at,
      })),
    });
  } catch (e: any) {
    return j({ error: e?.message ?? String(e) }, e?.status ?? 500);
  }
});