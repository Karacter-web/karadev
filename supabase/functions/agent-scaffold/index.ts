// Generate a full project file tree from a prompt + analysis, using DeepSeek Coder.
// Returns { files: [{ path, content }] } that agent-deploy will push to GitHub.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
const DEEPSEEK_MODEL = 'deepseek-coder';

const SYSTEM_PROMPT = `You are an elite full-stack engineer. You MUST output strict JSON in the shape:
{"project_name":"kebab-case-name","description":"one-line","files":[{"path":"relative/path","content":"file contents as string"}]}

Rules:
- Generate a complete, runnable project. Include package.json (with all needed deps and scripts), README.md, .gitignore, source files.
- Use the provided technical plan exactly. Do not invent unrelated features.
- Keep total under 25 files. Prioritize core working code over scaffolding.
- File contents MUST be plain strings (escape newlines as \\n). No code fences inside content.
- Output ONLY the JSON object. No prose, no markdown, no commentary.`;

async function callDeepSeek(prompt: string): Promise<any> {
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not set');
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 8000,
    }),
  });
  if (!r.ok) throw new Error(`DeepSeek ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const content = j.choices?.[0]?.message?.content ?? '{}';
  try { return JSON.parse(content); }
  catch {
    // Try to salvage JSON from text
    const m = content.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('DeepSeek returned non-JSON');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { prompt, analysis } = await req.json();
    if (!prompt) throw new Error('prompt required');

    const userMsg = `USER PROMPT:\n${prompt}\n\nTECHNICAL PLAN (from analyzer):\n${analysis ?? '(no analysis)'}\n\nNow produce the JSON project payload.`;
    const payload = await callDeepSeek(userMsg);

    const files = Array.isArray(payload.files) ? payload.files.filter((f: any) => f?.path && typeof f.content === 'string') : [];
    if (!files.length) throw new Error('Model returned no files');

    return new Response(JSON.stringify({
      project_name: payload.project_name ?? 'karadev-generated',
      description: payload.description ?? '',
      files,
      model: DEEPSEEK_MODEL,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});