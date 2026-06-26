// Execute code in a sandboxed RunPod serverless endpoint.
// Requires: RUNPOD_API_KEY (set) and RUNPOD_ENDPOINT_ID (admin-configured endpoint that accepts {code, language}).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const RUNPOD_API_KEY = Deno.env.get('RUNPOD_API_KEY');
const RUNPOD_ENDPOINT_ID = Deno.env.get('RUNPOD_ENDPOINT_ID'); // serverless endpoint id (user-supplied)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

type Lang = 'python' | 'javascript' | 'typescript';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    if (!RUNPOD_API_KEY) return j({ error: 'RunPod API error: RUNPOD_API_KEY not configured' }, 500);

    // AuthZ: admin only
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return j({ error: 'unauthorized' }, 401);
    const { data: isAdmin } = await sb.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return j({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? '');
    const language = (body.language ?? 'python') as Lang;
    const timeout = Math.min(Math.max(Number(body.timeout ?? 30), 1), 120);
    if (!code.trim()) return j({ error: 'code required' }, 400);
    if (!['python', 'javascript', 'typescript'].includes(language)) return j({ error: 'invalid language' }, 400);

    if (!RUNPOD_ENDPOINT_ID) {
      // Local fallback for javascript / typescript using JS eval-in-isolate when no endpoint configured.
      if (language === 'javascript' || language === 'typescript') {
        const start = Date.now();
        try {
          const logs: string[] = [];
          const sandboxConsole = { log: (...a: unknown[]) => logs.push(a.map(String).join(' ')) };
          // deno-lint-ignore no-new-func
          const fn = new Function('console', `"use strict"; ${code}`);
          const result = await Promise.race([
            Promise.resolve(fn(sandboxConsole)),
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), timeout * 1000)),
          ]);
          return j({ output: logs.join('\n') + (result !== undefined ? `\n=> ${String(result)}` : ''), executionTime: Date.now() - start });
        } catch (e) {
          return j({ output: '', error: (e as Error).message, executionTime: Date.now() - start });
        }
      }
      return j({ error: 'RunPod API error: RUNPOD_ENDPOINT_ID not configured. Set it to a serverless endpoint that accepts { code, language }.' }, 500);
    }

    const start = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), (timeout + 5) * 1000);
    let res: Response;
    try {
      res = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { code, language, timeout } }),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      return j({ error: `RunPod API error: ${(e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message}` }, 504);
    }
    clearTimeout(timer);

    const text = await res.text();
    if (!res.ok) return j({ error: `RunPod API error: HTTP ${res.status}` }, 502);
    let payload: any = {};
    try { payload = JSON.parse(text); } catch { payload = { output: text }; }
    const out = payload.output ?? payload.result ?? payload;
    return j({
      output: typeof out === 'string' ? out : (out?.stdout ?? JSON.stringify(out)),
      error: out?.stderr || out?.error || undefined,
      executionTime: Date.now() - start,
    });
  } catch (e) {
    return j({ error: `RunPod API error: ${(e as Error).message}` }, 500);
  }
});