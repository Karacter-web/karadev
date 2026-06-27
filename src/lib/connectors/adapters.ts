import type { ProviderName } from "./providers";

export type ValidateResult = {
  valid: boolean;
  error?: string;
  capabilities: string[];
  meta?: Record<string, any>;
};

export type HealthResult = {
  healthy: boolean;
  error?: string;
  warning?: string;
  meta?: Record<string, any>;
};

type Adapter = {
  validate(creds: Record<string, string>): Promise<ValidateResult>;
  healthCheck(creds: Record<string, string>): Promise<HealthResult>;
};

// Credentials are stored as plaintext in `user_connectors`, protected by
// row-level security (only the owning user can read their row). Client-side
// reversible obfuscation provides no real protection, so it has been removed.
// For at-rest encryption, move credential handling into an edge function and
// encrypt with `crypto.subtle` (AES-GCM) using a server-only key.
const token = (c: Record<string, string>) => c.token || "";

const githubAdapter: Adapter = {
  async validate(c) {
    try {
      const r = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token(c)}`, Accept: "application/vnd.github+json" },
      });
      if (!r.ok) return { valid: false, error: `GitHub auth failed (${r.status})`, capabilities: [] };
      const u = await r.json();
      return { valid: true, capabilities: ["repos.read", "repos.write", "read:user"], meta: { login: u.login } };
    } catch {
      return { valid: false, error: "Network error reaching GitHub", capabilities: [] };
    }
  },
  async healthCheck(c) {
    try {
      const r = await fetch("https://api.github.com/rate_limit", {
        headers: { Authorization: `Bearer ${token(c)}` },
      });
      if (r.status === 401) return { healthy: false, error: "Token expired or revoked" };
      if (!r.ok) return { healthy: false, error: `Health check failed (${r.status})` };
      const data = await r.json();
      const remaining = data?.rate?.remaining ?? 0;
      if (remaining < 10) return { healthy: true, warning: `Rate limit low: ${remaining} remaining` };
      return { healthy: true, meta: { remaining } };
    } catch {
      return { healthy: false, error: "Network error" };
    }
  },
};

const supabaseAdapter: Adapter = {
  async validate(c) {
    try {
      const r = await fetch("https://api.supabase.com/v1/organizations", {
        headers: { Authorization: `Bearer ${token(c)}` },
      });
      if (!r.ok) return { valid: false, error: `Supabase auth failed (${r.status})`, capabilities: [] };
      const orgs = await r.json();
      return { valid: true, capabilities: ["projects.read", "db.read", "functions.read"], meta: { orgs: orgs.length } };
    } catch {
      return { valid: false, error: "Network error reaching Supabase Management API", capabilities: [] };
    }
  },
  async healthCheck(c) {
    try {
      const r = await fetch("https://api.supabase.com/v1/organizations", {
        headers: { Authorization: `Bearer ${token(c)}` },
      });
      if (r.status === 401 || r.status === 403) return { healthy: false, error: "Token expired or revoked" };
      if (!r.ok) return { healthy: false, error: `Health check failed (${r.status})` };
      return { healthy: true };
    } catch {
      return { healthy: false, error: "Network error" };
    }
  },
};

const vercelAdapter: Adapter = {
  async validate(c) {
    try {
      const r = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${token(c)}` },
      });
      if (!r.ok) return { valid: false, error: `Vercel auth failed (${r.status})`, capabilities: [] };
      const u = await r.json();
      return { valid: true, capabilities: ["deploy.read", "deploy.write", "projects.read"], meta: { user: u?.user?.username } };
    } catch {
      return { valid: false, error: "Network error reaching Vercel", capabilities: [] };
    }
  },
  async healthCheck(c) {
    try {
      const r = await fetch("https://api.vercel.com/v2/user", { headers: { Authorization: `Bearer ${token(c)}` } });
      if (r.status === 401 || r.status === 403) return { healthy: false, error: "Token expired or revoked" };
      if (!r.ok) return { healthy: false, error: `Health check failed (${r.status})` };
      return { healthy: true };
    } catch {
      return { healthy: false, error: "Network error" };
    }
  },
};

const netlifyAdapter: Adapter = {
  async validate(c) {
    try {
      const r = await fetch("https://api.netlify.com/api/v1/user", {
        headers: { Authorization: `Bearer ${token(c)}` },
      });
      if (!r.ok) return { valid: false, error: `Netlify auth failed (${r.status})`, capabilities: [] };
      const u = await r.json();
      return { valid: true, capabilities: ["deploy.read", "deploy.write", "sites.read"], meta: { email: u.email } };
    } catch {
      return { valid: false, error: "Network error reaching Netlify", capabilities: [] };
    }
  },
  async healthCheck(c) {
    try {
      const r = await fetch("https://api.netlify.com/api/v1/user", { headers: { Authorization: `Bearer ${token(c)}` } });
      if (r.status === 401) return { healthy: false, error: "Token expired or revoked" };
      if (!r.ok) return { healthy: false, error: `Health check failed (${r.status})` };
      return { healthy: true };
    } catch {
      return { healthy: false, error: "Network error" };
    }
  },
};

const googleAdapter: Adapter = {
  async validate(c) {
    try {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token(c))}`);
      if (!r.ok) return { valid: false, error: `Google token invalid (${r.status})`, capabilities: [] };
      const info = await r.json();
      if (info.error) return { valid: false, error: info.error_description || info.error, capabilities: [] };
      return { valid: true, capabilities: ["cloud.read"], meta: { scope: info.scope, expires_in: info.expires_in } };
    } catch {
      return { valid: false, error: "Network error reaching Google OAuth", capabilities: [] };
    }
  },
  async healthCheck(c) {
    return this.validate(c).then((v) => ({ healthy: v.valid, error: v.error }));
  },
};

export const ADAPTERS: Record<ProviderName, Adapter> = {
  github: githubAdapter,
  supabase: supabaseAdapter,
  vercel: vercelAdapter,
  netlify: netlifyAdapter,
  google: googleAdapter,
};