import { Github, Cloud, Triangle, Globe, Database } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ProviderName = "github" | "supabase" | "vercel" | "netlify" | "google";

export type ProviderField = {
  key: string;
  label: string;
  placeholder: string;
  type: "password" | "text";
};

export type ProviderConfig = {
  name: ProviderName;
  label: string;
  description: string;
  icon: LucideIcon;
  capabilities: string[];
  helpUrl?: string;
  fields: ProviderField[];
};

export const PROVIDERS: ProviderConfig[] = [
  {
    name: "github",
    label: "GitHub",
    description: "Repository management, code search & file browsing",
    icon: Github,
    capabilities: ["repos.read", "repos.write", "read:user", "read:org"],
    helpUrl: "https://github.com/settings/tokens?type=beta",
    fields: [{ key: "token", label: "Personal Access Token", placeholder: "ghp_xxxxxxxxxxxx", type: "password" }],
  },
  {
    name: "supabase",
    label: "Supabase",
    description: "Manage organizations, projects & edge functions",
    icon: Database,
    capabilities: ["projects.read", "projects.write", "db.read", "functions.read"],
    helpUrl: "https://supabase.com/dashboard/account/tokens",
    fields: [{ key: "token", label: "Access Token", placeholder: "sbp_xxxxxxxxxxxx", type: "password" }],
  },
  {
    name: "vercel",
    label: "Vercel",
    description: "Deployments, projects & edge functions",
    icon: Triangle,
    capabilities: ["deploy.read", "deploy.write", "projects.read"],
    helpUrl: "https://vercel.com/account/tokens",
    fields: [{ key: "token", label: "API Token", placeholder: "Bearer xxxxxxxxx", type: "password" }],
  },
  {
    name: "netlify",
    label: "Netlify",
    description: "Static hosting & serverless functions",
    icon: Globe,
    capabilities: ["deploy.read", "deploy.write", "sites.read"],
    helpUrl: "https://app.netlify.com/user/applications#personal-access-tokens",
    fields: [{ key: "token", label: "Access Token", placeholder: "nfp_xxxxxxxxxxxx", type: "password" }],
  },
  {
    name: "google",
    label: "Google Cloud",
    description: "Cloud services & APIs (OAuth access token)",
    icon: Cloud,
    capabilities: ["cloud.read", "projects.read"],
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    fields: [{ key: "token", label: "OAuth Access Token", placeholder: "ya29.xxxxx...", type: "password" }],
  },
];

export const PROVIDER_MAP: Record<ProviderName, ProviderConfig> =
  Object.fromEntries(PROVIDERS.map((p) => [p.name, p])) as any;