// Admin-only audit scanner. Runs DB schema + RLS + secrets + edge-function introspection,
// applies the configured per-admin 24h rate limit, and persists a full JSON report.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

type Severity = 'critical' | 'high' | 'medium' | 'low';
type Category = 'database' | 'codebase' | 'infrastructure' | 'configurations' | 'security' | 'performance';
interface Issue {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  location: string;
  suggested_fix: string;
  status: 'new';
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function newIssue(i: Omit<Issue, 'id' | 'status'>): Issue {
  return { ...i, id: crypto.randomUUID(), status: 'new' };
}

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Slack token', re: /xox[abprs]-[0-9A-Za-z-]{10,}/ },
  { name: 'GitHub PAT', re: /gh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: 'OpenAI key', re: /sk-[A-Za-z0-9]{20,}/ },
  { name: 'JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
];

function redact(value: string) { return value.length <= 8 ? '[REDACTED]' : value.slice(0, 4) + '…[REDACTED]'; }

async function scanDatabase(admin: ReturnType<typeof createClient>): Promise<{ indexed: string[]; issues: Issue[]; warnings: string[] }> {
  const indexed: string[] = [];
  const issues: Issue[] = [];
  const warnings: string[] = [];

  // List public tables
  const tablesRes = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SERVICE_KEY}`, {
    headers: { 'Accept': 'application/openapi+json', 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  if (!tablesRes.ok) {
    warnings.push(`Failed to introspect schema: HTTP ${tablesRes.status}`);
    return { indexed, issues, warnings };
  }
  const openapi = await tablesRes.json();
  const tables = Object.keys(openapi.definitions ?? {});
  indexed.push(...tables);

  // For each table, attempt SELECT with anon key to check RLS surface.
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  for (const t of tables) {
    try {
      const probe = await fetch(`${SUPABASE_URL}/rest/v1/${t}?select=*&limit=1`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      if (probe.ok) {
        const rows = await probe.json();
        if (Array.isArray(rows) && rows.length > 0) {
          issues.push(newIssue({
            category: 'database',
            severity: 'critical',
            title: `Anonymous read exposes data in public.${t}`,
            description: `Anonymous role can SELECT rows from public.${t}. RLS is either disabled or has a policy that grants anon read access.`,
            location: `public.${t}`,
            suggested_fix: `Enable RLS on public.${t} and replace any \`USING (true)\` policy with one scoped to auth.uid(). If this table is meant to be public, document it.`,
          }));
        }
      }
    } catch (e) { warnings.push(`Probe ${t}: ${(e as Error).message}`); }
  }

  return { indexed, issues, warnings };
}

async function scanSecrets(): Promise<{ indexed: string[]; issues: Issue[] }> {
  const known = [
    'SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_JWKS',
    'SUPABASE_PUBLISHABLE_KEY','SUPABASE_PUBLISHABLE_KEYS','SUPABASE_SECRET_KEYS','SUPABASE_DB_URL',
    'LOVABLE_API_KEY','OPENROUTER_API_KEY','DEEPSEEK_API_KEY','HUGGINGFACE_TOKEN',
    'KARACTERHUB_GITHUB_APP_ID','KARACTERHUB_GITHUB_APP_INSTALLATION_ID','KARACTERHUB_GITHUB_APP_PRIVATE_KEY',
  ];
  const indexed: string[] = [];
  const issues: Issue[] = [];
  for (const name of known) {
    const v = Deno.env.get(name);
    if (!v) {
      issues.push(newIssue({
        category: 'configurations',
        severity: name.includes('SERVICE_ROLE') || name.includes('PRIVATE_KEY') ? 'high' : 'medium',
        title: `Missing secret: ${name}`,
        description: `Edge-function secret ${name} is not configured. Dependent functions will fail.`,
        location: `supabase.secrets.${name}`,
        suggested_fix: `Add ${name} via Supabase dashboard → Edge Functions → Secrets.`,
      }));
      continue;
    }
    indexed.push(name);
    for (const pat of SECRET_PATTERNS) {
      if (pat.re.test(v)) {
        issues.push(newIssue({
          category: 'security',
          severity: 'critical',
          title: `Detected ${pat.name} pattern inside secret ${name}`,
          description: `Secret ${name} value matches ${pat.name} pattern (${redact(v)}). Confirm the value is the intended one and rotate if exposed.`,
          location: `supabase.secrets.${name}`,
          suggested_fix: `Rotate the ${pat.name} immediately if this value has ever been committed or shared.`,
        }));
      }
    }
  }
  return { indexed, issues };
}

async function runScan(target: string, admin: ReturnType<typeof createClient>) {
  const indexed: Record<string, string[]> = { database: [], codebase: [], infrastructure: [], configurations: [] };
  const warnings: string[] = [];
  let issues: Issue[] = [];

  if (target === 'full' || target === 'db') {
    try {
      const r = await scanDatabase(admin);
      indexed.database = r.indexed; issues = issues.concat(r.issues); warnings.push(...r.warnings);
    } catch (e) { warnings.push(`db scan failed: ${(e as Error).message}`); }
  }
  if (target === 'full' || target === 'config') {
    try {
      const r = await scanSecrets();
      indexed.configurations = r.indexed; issues = issues.concat(r.issues);
    } catch (e) { warnings.push(`config scan failed: ${(e as Error).message}`); }
  }
  if (target === 'full' || target === 'infra') {
    // Edge function introspection (names only; deeper checks require management API key).
    indexed.infrastructure = ['supabase-edge-functions','supabase-auth','supabase-postgrest','supabase-realtime'];
  }
  if (target === 'full' || target === 'code') {
    try {
      const r = await scanCode();
      indexed.codebase = r.indexed; issues = issues.concat(r.issues); warnings.push(...r.warnings);
    } catch (e) { warnings.push(`code scan failed: ${(e as Error).message}`); }
  }

  const by_severity = { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>;
  const by_category = { database: 0, codebase: 0, infrastructure: 0, configurations: 0, security: 0, performance: 0 } as Record<Category, number>;
  for (const i of issues) { by_severity[i.severity]++; by_category[i.category]++; }

  return { indexed, results: { errors: issues }, warnings, summary: { total_issues: issues.length, by_severity, by_category } };
}

// Static analysis over repos connected via the Karacterhub GitHub App installation.
async function scanCode(): Promise<{ indexed: string[]; issues: Issue[]; warnings: string[] }> {
  const indexed: string[] = []; const issues: Issue[] = []; const warnings: string[] = [];
  try {
    const { getInstallationToken, ghHeaders } = await import('../_shared/github-app.ts');
    const token = await getInstallationToken();
    const headers = ghHeaders(token);
    const repoListRes = await fetch('https://api.github.com/installation/repositories?per_page=50', { headers });
    if (!repoListRes.ok) { warnings.push(`Repo list: ${repoListRes.status}`); return { indexed, issues, warnings }; }
    const repos = ((await repoListRes.json()).repositories ?? []).slice(0, 10);
    for (const repo of repos) {
      indexed.push(repo.full_name);
      const branch = repo.default_branch || 'main';
      const treeRes = await fetch(`https://api.github.com/repos/${repo.full_name}/git/trees/${branch}?recursive=1`, { headers });
      if (!treeRes.ok) continue;
      const tree = await treeRes.json();
      const files = (tree.tree as any[]).filter((n) => n.type === 'blob');
      const pkg = files.find((f) => f.path === 'package.json');
      if (pkg) {
        const r = await fetch(`https://api.github.com/repos/${repo.full_name}/contents/package.json?ref=${branch}`, { headers });
        if (r.ok) {
          const c = await r.json();
          const decoded = atob(c.content.replace(/\n/g, ''));
          try {
            const json = JSON.parse(decoded);
            const deps = { ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) };
            for (const [name, ver] of Object.entries(deps)) {
              if (typeof ver === 'string' && /^[\^~]?0\.0\./.test(ver)) {
                issues.push(newIssue({ category: 'codebase', severity: 'low',
                  title: `Pinned to pre-release: ${name}@${ver}`,
                  description: `${name} is pinned to a 0.0.x release in ${repo.full_name}; expect breaking changes.`,
                  location: `${repo.full_name}/package.json`,
                  suggested_fix: `Upgrade ${name} to a stable release and re-run tests.` }));
              }
            }
          } catch { /* ignore parse */ }
        }
      }
      // Sample first 25 small text files for secret patterns
      const text = files.filter((f) => /\.(t|j)sx?$|\.env|\.ya?ml|\.json|\.md$/.test(f.path)).slice(0, 25);
      for (const f of text) {
        const r = await fetch(`https://api.github.com/repos/${repo.full_name}/contents/${encodeURIComponent(f.path)}?ref=${branch}`, { headers });
        if (!r.ok) continue;
        const c = await r.json();
        if (c.size > 200_000) continue;
        const decoded = atob((c.content ?? '').replace(/\n/g, ''));
        for (const pat of SECRET_PATTERNS) {
          if (pat.re.test(decoded)) {
            issues.push(newIssue({ category: 'security', severity: 'critical',
              title: `Possible ${pat.name} in ${repo.full_name}/${f.path}`,
              description: `Pattern matching ${pat.name} found in source. Confirm and rotate immediately if real.`,
              location: `${repo.full_name}/${f.path}`,
              suggested_fix: `Remove the value from source, rotate the credential, and load it from an environment variable / secret manager.` }));
            break;
          }
        }
      }
    }
  } catch (e) { warnings.push(`code scan: ${(e as Error).message}`); }
  return { indexed, issues, warnings };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const user = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: u } } = await user.auth.getUser();
    if (!u) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: isAdmin } = await user.rpc('has_role', { _user_id: u.id, _role: 'admin' });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Settings
    const { data: settings } = await admin.from('audit_settings').select('*').eq('id', 1).maybeSingle();
    if (settings && settings.enabled === false) {
      return new Response(JSON.stringify({ error: 'Audit scans are disabled' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const limit = settings?.rate_limit_per_24h ?? 2;

    // Rate limit per admin per 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('audit_scans').select('id', { count: 'exact', head: true })
      .eq('admin_user_id', u.id).gte('created_at', since);
    if ((count ?? 0) >= limit) {
      const { data: oldest } = await admin.from('audit_scans').select('created_at')
        .eq('admin_user_id', u.id).gte('created_at', since)
        .order('created_at', { ascending: true }).limit(1).maybeSingle();
      const next = oldest ? new Date(new Date(oldest.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString() : null;
      return new Response(JSON.stringify({ error: `Rate limit exceeded. Maximum ${limit} scans per 24 hours.`, next_available_scan: next }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const target = (body.target ?? 'full') as string;
    const trigger_method = (body.trigger_method ?? 'dashboard') as string;

    // Insert pending row
    const { data: row, error: insErr } = await admin.from('audit_scans')
      .insert({ admin_user_id: u.id, target, trigger_method, status: 'running' })
      .select('id').single();
    if (insErr || !row) throw new Error(insErr?.message ?? 'failed to create scan row');

    try {
      const report = await runScan(target, admin);
      const critical = report.summary.by_severity.critical;
      const metadata = {
        scan_id: row.id,
        timestamp: new Date().toISOString(),
        triggered_by: u.email ?? u.id,
        trigger_method,
        rate_limit_remaining: Math.max(0, limit - ((count ?? 0) + 1)),
      };
      const full = { scan_metadata: metadata, ...report };
      await admin.from('audit_scans').update({
        status: 'complete',
        issues_count: report.summary.total_issues,
        critical_count: critical,
        report: full,
        completed_at: new Date().toISOString(),
      }).eq('id', row.id);
      return new Response(JSON.stringify({ scan_id: row.id, report: full }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      await admin.from('audit_scans').update({ status: 'failed', error: msg, completed_at: new Date().toISOString() }).eq('id', row.id);
      return new Response(JSON.stringify({ error: msg, scan_id: row.id }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});