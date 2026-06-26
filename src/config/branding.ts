/**
 * Karadev — a subsidiary of Karacterhub.
 * Centralized branding & platform identity for the product.
 * Import from this file instead of hard-coding strings/URLs.
 */

export const branding = {
  product: "Karadev",
  tagline: "AI-powered collaborative development platform",
  parent: {
    name: "Karacterhub",
    url: "https://dev.karacterhub.xyz",
  },
  domains: {
    /** Public marketing / app root */
    app: "https://karacterhub.xyz",
    /** Dev mode IDE host (the embedded VS Code experience) */
    devIde: "https://dev.karacterhub.xyz/ide",
    /** Local fallback used during development */
    devIdeLocal: "http://localhost:5173/ide",
  },
  agent: {
    name: "DevAgent",
    description: "Context-aware AI development assistant",
  },
  support: {
    email: "support@karacterhub.xyz",
    security: "security@karacterhub.xyz",
  },
  copyright: `© ${new Date().getFullYear()} Karacterhub. All rights reserved.`,
} as const;

/**
 * Build a sandboxed Dev-mode IDE URL for the given session id.
 * The session uuid scopes the iframe to a user-isolated workspace.
 */
export function buildDevIdeUrl(sessionId: string, opts?: { local?: boolean }) {
  const base = opts?.local ? branding.domains.devIdeLocal : branding.domains.devIde;
  const encoded = encodeURIComponent(sessionId);
  return `${base}/${encoded}`;
}

export type Branding = typeof branding;
