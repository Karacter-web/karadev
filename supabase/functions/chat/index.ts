import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// --- OpenRouter config ---
// Free-tier model used as the primary provider while this tool is in
// developer-only mode. Swap via env var without redeploying logic changes.
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL =
  Deno.env.get("OPENROUTER_MODEL") || "meta-llama/llama-3.3-70b-instruct:free";
const THINK_MODEL =
  Deno.env.get("OPENROUTER_THINK_MODEL") || "meta-llama/llama-3.3-70b-instruct:free";

// Daily request cap per user while running on free-tier models.
const DAILY_LIMIT = Number(Deno.env.get("DAILY_MESSAGE_LIMIT") || "30");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Lightweight persona for the edge function — the full capability reference
// lives in agent-prompt.md and is loaded at boot so the function stays clean
// and the prompt is easy to edit by humans or machines.
const AGENT_INTRO = `You are Karacter, an expert AI development assistant. You are embedded in a team collaboration platform for software development.`;

const AGENT_INSTRUCTIONS = `
## How You Operate
Refer to your full capability reference (loaded below) for everything you can and cannot do.
Follow the Deep Analysis Protocol before every response:
1. Parse Intent — what is the user really asking?
2. Assess Scope — single-file, multi-file, database-touching?
3. Check Capabilities — can you fully deliver? Be honest if not.
4. Identify Risks — security, breaking changes, performance?
5. Plan Response — context → solution → implementation → caveats.

## Output Rules
- Be concise. No filler.
- Always include working code with proper TypeScript types.
- Use markdown: headers, bullets, code blocks with language tags.
- If you cannot do something, say so clearly and state what you CAN do instead.
- Never hallucinate capabilities, libraries, or APIs.
`;

// Load the full prompt reference from the companion markdown file.
// In edge-runtime the file sits next to index.ts.
let capabilityDocs = "";
try {
  capabilityDocs = await Deno.readTextFile(
    new URL("./agent-prompt.md", import.meta.url),
  );
} catch {
  console.warn("agent-prompt.md not found — running with inline prompt only");
}

const SYSTEM_PROMPT = [
  AGENT_INTRO,
  AGENT_INSTRUCTIONS,
  capabilityDocs
    ? `\n## Full Capability Reference\n\n${capabilityDocs}`
    : "",
].join("\n");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, think, repoContext } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    // --- Daily usage limit (free-tier protection) ---
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userId: string | null = null;
    try {
      const { data } = await supabaseAdmin.auth.getUser(jwt);
      userId = data?.user?.id ?? null;
    } catch {
      // anon key or invalid token — treat as unauthenticated, no per-user limit
    }

    if (userId) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const { data: usage } = await supabaseAdmin
        .from("daily_usage")
        .select("count")
        .eq("user_id", userId)
        .eq("usage_date", today)
        .maybeSingle();

      const currentCount = usage?.count ?? 0;
      if (currentCount >= DAILY_LIMIT) {
        return new Response(
          JSON.stringify({
            error: `Daily message limit reached (${DAILY_LIMIT}). This tool runs on free-tier models during development — try again tomorrow or contact the admin to raise the limit.`,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      await supabaseAdmin
        .from("daily_usage")
        .upsert(
          { user_id: userId, usage_date: today, count: currentCount + 1 },
          { onConflict: "user_id,usage_date" },
        );
    }

    // --- Deep Thinking Layer ---
    // When `think: true`, we first ask the model to analyze the request
    // internally, then use that analysis to produce a better final answer.
    let thinkingContext = "";
    if (think) {
      const thinkResp = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://karadev-delta.vercel.app",
            "X-Title": "Karadev",
          },
          body: JSON.stringify({
            model: THINK_MODEL,
            messages: [
              {
                role: "system",
                content: `You are an internal analysis module. Given the conversation below, produce a concise analysis following this structure:
1. **User Intent**: What the user is really asking for (1 sentence)
2. **Scope**: Files, components, or systems affected
3. **Risks**: Security, breaking changes, performance concerns
4. **Approach**: Step-by-step plan to answer well (3-5 steps max)

Be brief. This analysis is internal and will NOT be shown to the user.`,
              },
              ...messages,
            ],
            stream: false,
          }),
        },
      );

      if (thinkResp.ok) {
        const thinkData = await thinkResp.json();
        thinkingContext =
          thinkData.choices?.[0]?.message?.content || "";
      }
    }

    // --- Main Response (Streaming) ---
    const systemMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Inject connected repository context if available
    if (repoContext) {
      systemMessages.push({
        role: "system",
        content: `## Repository Context (from user's connected GitHub repo)\n\n${repoContext}\n\nUse this file tree to provide accurate, context-aware answers about the user's codebase. Reference specific files when relevant.`,
      });
    }

    if (thinkingContext) {
      systemMessages.push({
        role: "system",
        content: `## Internal Analysis (not visible to user)\n${thinkingContext}\n\nUse this analysis to produce a high-quality, accurate response. Do NOT reference this analysis in your reply.`,
      });
    }

    const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://karadev-delta.vercel.app",
          "X-Title": "Karadev",
        },
        body: JSON.stringify({
          model: PRIMARY_MODEL,
          messages: [...systemMessages, ...messages],
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limits exceeded, please try again later.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Payment required, please add credits.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
