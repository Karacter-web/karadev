// Admin-only: discover or create a free-tier RunPod serverless endpoint.
// Returns { endpointId, created, endpoints } so the admin can save it as RUNPOD_ENDPOINT_ID.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const RUNPOD_API_KEY = Deno.env.get('RUNPOD_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const j = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    if (!RUNPOD_API_KEY) return j({ error: 'RUNPOD_API_KEY not configured in Supabase secrets' }, 500);

    // AuthZ: admin only
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return j({ error: 'unauthorized' }, 401);
    const { data: isAdmin } = await sb.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return j({ error: 'forbidden — admin only' }, 403);

    const body = await req.json().catch(() => ({}));
    const wantCreate = body.create === true;

    // 1. List existing endpoints via REST v1
    const listRes = await fetch('https://rest.runpod.io/v1/endpoints', {
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
    });
    const listText = await listRes.text();
    if (!listRes.ok) {
      return j({ error: `RunPod list failed: HTTP ${listRes.status}`, body: listText.slice(0, 500) }, 502);
    }
    let endpoints: any[] = [];
    try { endpoints = JSON.parse(listText); } catch { endpoints = []; }
    if (!Array.isArray(endpoints)) endpoints = (endpoints as any).endpoints ?? [];

    const summary = endpoints.map((e: any) => ({ id: e.id, name: e.name, workersMax: e.workersMax }));

    // Reuse existing karacterhub endpoint if present
    const existing = endpoints.find((e: any) => e.name === 'karacterhub-sandbox-free') ?? endpoints[0];
    if (existing && !wantCreate) {
      return j({
        endpointId: existing.id,
        created: false,
        endpoints: summary,
        note: 'Existing endpoint found. Save its id as RUNPOD_ENDPOINT_ID in Supabase secrets.',
      });
    }

    if (!wantCreate) {
      return j({
        endpointId: null,
        created: false,
        endpoints: summary,
        note: 'No endpoint found. POST again with { "create": true } to create a free-tier CPU endpoint.',
      });
    }

    // 2. Create a free-tier CPU serverless endpoint
    // RunPod REST v1 requires a templateId. We create a template first, then the endpoint.
    const tplRes = await fetch('https://rest.runpod.io/v1/templates', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'karacterhub-sandbox-tpl',
        imageName: 'runpod/python-node:3.10',
        containerDiskInGb: 5,
        dockerEntrypoint: [],
        dockerStartCmd: [],
        env: [],
        isServerless: true,
      }),
    });
    const tplText = await tplRes.text();
    if (!tplRes.ok) return j({ error: `RunPod template create failed: HTTP ${tplRes.status}`, body: tplText.slice(0, 800) }, 502);
    const tpl = JSON.parse(tplText);
    const templateId = tpl.id ?? tpl.templateId;

    const epRes = await fetch('https://rest.runpod.io/v1/endpoints', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'karacterhub-sandbox-free',
        templateId,
        computeType: 'CPU',
        workersMin: 0,
        workersMax: 1,
        idleTimeout: 5,
        executionTimeoutMs: 60_000,
      }),
    });
    const epText = await epRes.text();
    if (!epRes.ok) return j({ error: `RunPod endpoint create failed: HTTP ${epRes.status}`, body: epText.slice(0, 800), templateId }, 502);
    const ep = JSON.parse(epText);

    return j({
      endpointId: ep.id,
      templateId,
      created: true,
      note: 'Save endpointId as RUNPOD_ENDPOINT_ID in Supabase secrets.',
    });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});