// Embed token exchange: validates a workspace API key, returns a Supabase
// session scoped to the user who created the key so the embedded chat can
// run with normal RLS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const token = body?.token?.trim();
  if (!token || token.length < 16) return json({ error: "Invalid token" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const key_hash = await sha256Hex(token);
  const { data: key, error: keyErr } = await admin
    .from("api_keys")
    .select("id, workspace_id, created_by, expires_at, revoked_at")
    .eq("key_hash", key_hash)
    .maybeSingle();

  if (keyErr || !key) return json({ error: "Invalid token" }, 401);
  if (key.revoked_at) return json({ error: "Token revoked" }, 401);
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return json({ error: "Token expired" }, 401);
  }

  // Look up the email of the user who created the key.
  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(key.created_by);
  if (userErr || !userRes?.user?.email) return json({ error: "Invalid token" }, 401);
  const email = userRes.user.email;

  // Generate a magic link, then verify the OTP server-side to mint a real session.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    return json({ error: "Could not mint session" }, 500);
  }

  const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sess, error: sessErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (sessErr || !sess?.session) return json({ error: "Could not mint session" }, 500);

  // Update last_used_at (fire and forget — don't block response).
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(() => {});

  return json({
    access_token: sess.session.access_token,
    refresh_token: sess.session.refresh_token,
    workspace_id: key.workspace_id,
    expires_at: sess.session.expires_at,
  });
});
