// Deep analysis of a prompt + optional source URL/repo using Mistral via Hugging Face.
// Returns architecture/plan that agent-scaffold uses as grounding context.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const HF_TOKEN = Deno.env.get('HUGGINGFACE_TOKEN');
const MISTRAL_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('github.com')) return null;
    const [owner, repo] = u.pathname.replace(/^\//, '').split('/');
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/, '') };
  } catch { return null; }
}

async function fetchRepoSnapshot(url: string): Promise<string> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    // Try as plain URL
    try {
      const r = await fetch(url);
      const text = await r.text();
      return `# Source URL: ${url}\n\n${text.slice(0, 8000)}`;
    } catch { return `# Could not fetch ${url}`; }
  }
  const { owner, repo } = parsed;
  const headers: Record<string, string> = { 'User-Agent': 'karadev-agent' };
  const meta = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }).then(r => r.ok ? r.json() : null);
  const branch = meta?.default_branch || 'main';
  const tree = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers }).then(r => r.ok ? r.json() : null);
  const readme = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`, { headers }).then(r => r.ok ? r.text() : '');
  const pkg = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`, { headers }).then(r => r.ok ? r.text() : '');
  const files = (tree?.tree || []).slice(0, 200).map((f: any) => `${f.type} ${f.path}`).join('\n');
  return `# Repo: ${owner}/${repo}\nDescription: ${meta?.description ?? ''}\nLanguage: ${meta?.language ?? ''}\nStars: ${meta?.stargazers_count ?? 0}\n\n## README (truncated)\n${readme.slice(0, 4000)}\n\n## package.json\n${pkg.slice(0, 2000)}\n\n## File tree (first 200)\n${files}`;
}

async function callMistral(prompt: string): Promise<string> {
  if (!HF_TOKEN) throw new Error('HUGGINGFACE_TOKEN not set');
  const r = await fetch(`https://api-inference.huggingface.co/models/${MISTRAL_MODEL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        { role: 'system', content: 'You are a senior software architect. Analyze the user request and any provided source material, then produce a concise technical plan: chosen stack, file structure, key dependencies, and step-by-step build order. Be specific and decisive.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    }),
  });
  if (!r.ok) throw new Error(`Mistral/HF ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { prompt, source_url } = await req.json();
    if (!prompt) throw new Error('prompt required');

    let context = '';
    if (source_url) context = await fetchRepoSnapshot(source_url);

    const fullPrompt = `User request:\n${prompt}\n\n${context ? `Source material:\n${context}\n\n` : ''}Produce the technical plan now.`;
    const analysis = await callMistral(fullPrompt);

    return new Response(JSON.stringify({ analysis, model: MISTRAL_MODEL, source_context_chars: context.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});