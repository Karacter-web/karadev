// Shared GitHub PAT management.
// Tokens are persisted in Supabase (`public.user_github_tokens`) and protected
// by row-level security so each user can only read or modify their own token.
// An in-memory cache keeps the synchronous `githubHeaders()` helper usable
// after `loadGitHubToken()` (or `setGitHubToken()`) has run once per session.

import { supabase } from "@/integrations/supabase/client";

let cachedToken = "";
let hydrated = false;

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Load the token from Supabase into the in-memory cache. Returns "" if none. */
export async function loadGitHubToken(): Promise<string> {
  const uid = await currentUserId();
  if (!uid) {
    cachedToken = "";
    hydrated = true;
    return "";
  }
  const { data } = await (supabase as any)
    .from("user_github_tokens")
    .select("token")
    .eq("user_id", uid)
    .maybeSingle();
  cachedToken = (data?.token as string) || "";
  hydrated = true;
  return cachedToken;
}

/** Synchronous accessor — returns the cached token (empty until hydrated). */
export function getGitHubToken(): string {
  return cachedToken;
}

/** Persist or clear the user's GitHub token. Validates against GitHub before saving. */
export async function setGitHubToken(token: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error("You must be signed in to manage GitHub tokens.");

  if (!token) {
    await (supabase as any).from("user_github_tokens").delete().eq("user_id", uid);
    cachedToken = "";
    return;
  }

  // Server-side validation: confirm the token works before persisting.
  const probe = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!probe.ok) {
    throw new Error(`GitHub rejected the token (${probe.status}). Not saved.`);
  }

  const { error } = await (supabase as any)
    .from("user_github_tokens")
    .upsert({ user_id: uid, token, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  cachedToken = token;
  hydrated = true;
}

export function hasGitHubToken(): boolean {
  return !!cachedToken;
}

export function isGitHubTokenHydrated(): boolean {
  return hydrated;
}

/**
 * Build headers for GitHub API requests.
 * Uses the stored PAT when available (5000 req/hr), falls back to unauthenticated (60 req/hr).
 */
export function githubHeaders(): Record<string, string> {
  const token = cachedToken;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Validate the cached token against GitHub. Auto-revokes (deletes) it if invalid.
 * Returns true if the token is present and valid.
 */
export async function validateGitHubToken(): Promise<boolean> {
  if (!cachedToken) return false;
  try {
    const res = await fetch("https://api.github.com/user", { headers: githubHeaders() });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403) {
      await setGitHubToken("");
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Fetch the top-level file tree of a repo (names + types only) for AI context injection.
 * Returns a compact string representation or null on failure.
 */
export async function fetchRepoTree(
  repoFullName: string,
  branch = "main"
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/trees/${branch}?recursive=1`,
      { headers: githubHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.tree) return null;
    // Cap at 200 entries to keep context manageable
    const entries = data.tree
      .slice(0, 200)
      .map((e: { path: string; type: string }) =>
        `${e.type === "tree" ? "📁" : "📄"} ${e.path}`
      );
    return entries.join("\n");
  } catch {
    return null;
  }
}

/**
 * Fetch a single file's raw text content from a repo.
 * Returns null on failure or if the file is too large/binary.
 */
export async function fetchRepoFile(
  repoFullName: string,
  path: string,
  branch = "main",
  maxBytes = 20_000
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoFullName}/contents/${path}?ref=${branch}`,
      { headers: githubHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.content || data.encoding !== "base64") return null;
    const decoded = atob(data.content.replace(/\n/g, ""));
    return decoded.slice(0, maxBytes);
  } catch {
    return null;
  }
}

/**
 * Build a rich repo snapshot for AI context: file tree + README + package.json/manifest.
 * Returns a markdown-formatted string ready to inject into the system prompt.
 */
export async function fetchRepoSnapshot(
  repoFullName: string,
  branch = "main"
): Promise<string | null> {
  const tree = await fetchRepoTree(repoFullName, branch);
  if (!tree) return null;

  const sections: string[] = [
    `## Connected Repository: ${repoFullName} (branch: ${branch})`,
    `\n### File Tree\n\`\`\`\n${tree}\n\`\`\``,
  ];

  // Try common manifest / readme files in parallel
  const candidates = [
    "README.md",
    "readme.md",
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "Cargo.toml",
    "go.mod",
    "tsconfig.json",
  ];
  const results = await Promise.all(
    candidates.map((p) => fetchRepoFile(repoFullName, p, branch, 8000))
  );
  results.forEach((content, i) => {
    if (content) {
      sections.push(`\n### ${candidates[i]}\n\`\`\`\n${content}\n\`\`\``);
    }
  });

  return sections.join("\n");
}
