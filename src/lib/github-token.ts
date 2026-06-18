// Shared GitHub PAT management — used by GitHubFileBrowser, Chat, Repos, etc.

const STORAGE_KEY = "gh_pat_enc";

const encode = (val: string) =>
  btoa(encodeURIComponent(val).split("").reverse().join(""));

const decode = (val: string) =>
  decodeURIComponent(atob(val).split("").reverse().join(""));

export function getGitHubToken(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? decode(stored) : "";
  } catch {
    return "";
  }
}

export function setGitHubToken(token: string) {
  if (token) {
    localStorage.setItem(STORAGE_KEY, encode(token));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasGitHubToken(): boolean {
  return !!getGitHubToken();
}

/**
 * Build headers for GitHub API requests.
 * Uses the stored PAT when available (5000 req/hr), falls back to unauthenticated (60 req/hr).
 */
export function githubHeaders(): Record<string, string> {
  const token = getGitHubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
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
