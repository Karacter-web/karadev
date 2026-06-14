import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Moon, Sun, Database, Shield, Cloud, Key, Cpu, Globe, Radio, GitBranch, RefreshCw, Eye, EyeOff, Check, Github } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Integration = {
  name: string;
  category: "Infrastructure" | "AI & Models" | "Auth & Security" | "Database";
  status: "active" | "configured" | "available";
  description: string;
  icon: typeof Database;
};

const INTEGRATIONS: Integration[] = [
  { name: "Lovable Cloud", category: "Infrastructure", status: "active", description: "Backend hosting, edge functions & deployment", icon: Cloud },
  { name: "GitHub", category: "Infrastructure", status: "active", description: "Repository sync, version control & CI/CD pipeline", icon: GitBranch },
  { name: "PostgreSQL Database", category: "Database", status: "active", description: "Managed relational database with RLS policies", icon: Database },
  { name: "Row-Level Security", category: "Auth & Security", status: "active", description: "Per-table access control policies enforced at DB level", icon: Shield },
  { name: "Auth System", category: "Auth & Security", status: "active", description: "Email/password & Google OAuth authentication", icon: Key },
  { name: "Edge Functions", category: "Infrastructure", status: "active", description: "Serverless backend functions (chat, AI agent)", icon: Cpu },
  { name: "Lovable AI Models", category: "AI & Models", status: "active", description: "Gemini & GPT models via built-in API key", icon: Cpu },
  { name: "Realtime Subscriptions", category: "Database", status: "available", description: "Live data sync via websocket channels", icon: Radio },
  { name: "Storage Buckets", category: "Infrastructure", status: "available", description: "File & asset storage (not yet configured)", icon: Globe },
];

const statusColors: Record<Integration["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  configured: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  available: "bg-muted text-muted-foreground border-border",
};

import { getGitHubToken, setGitHubToken, hasGitHubToken } from "@/lib/github-token";

export default function SettingsPage() {
  const { user } = useAuth();
  const [dark, setDark] = useState(false);
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "error">("checking");
  const [ghToken, setGhToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [hasStoredToken, setHasStoredToken] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setHasStoredToken(hasGitHubToken());
    // Real-time DB health check
    const check = async () => {
      try {
        const { error } = await supabase.from("profiles").select("id").limit(1);
        setDbStatus(error ? "error" : "connected");
      } catch { setDbStatus("error"); }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const saveGhToken = () => {
    if (!ghToken.trim()) return;
    setGitHubToken(ghToken.trim());
    setHasStoredToken(true);
    setTokenSaved(true);
    setGhToken("");
    setShowToken(false);
    toast({ title: "GitHub token saved", description: "Your personal access token has been stored locally." });
    setTimeout(() => setTokenSaved(false), 2000);
  };

  const removeGhToken = () => {
    setGitHubToken("");
    setHasStoredToken(false);
    setGhToken("");
    toast({ title: "GitHub token removed" });
  };

  const refreshDbStatus = async () => {
    setDbStatus("checking");
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      setDbStatus(error ? "error" : "connected");
    } catch { setDbStatus("error"); }
  };

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setDark(!dark);
  };

  const categories = [...new Set(INTEGRATIONS.map(i => i.category))];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your account & view integrations</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm"><span className="text-muted-foreground">Email:</span> {user?.email}</p>
          <p className="text-sm"><span className="text-muted-foreground">Name:</span> {user?.user_metadata?.full_name || "Not set"}</p>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Toggle between light and dark mode</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={toggleTheme}>
            {dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {dark ? "Light Mode" : "Dark Mode"}
          </Button>
        </CardContent>
      </Card>

      {/* GitHub Personal Access Token */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>GitHub Access Token</CardTitle>
              <CardDescription>Configure a personal access token for GitHub API access (repo browsing, etc.)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasStoredToken ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card/50">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium">Token configured</span>
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Active</Badge>
              </div>
              <Button variant="destructive" size="sm" onClick={removeGhToken}>Remove</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="gh-token">Personal Access Token</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="gh-token"
                      type={showToken ? "text" : "password"}
                      value={ghToken}
                      onChange={(e) => setGhToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
                    >
                      {showToken ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                  <Button onClick={saveGhToken} disabled={!ghToken.trim() || tokenSaved}>
                    {tokenSaved ? <><Check className="mr-1 h-4 w-4" /> Saved</> : "Save"}
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-2">
                <p>
                  Generate a token at{" "}
                  <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
                    github.com/settings/tokens
                  </a>
                  {" "}(Fine-grained recommended). Stored locally in your browser only.
                </p>
                <div className="rounded-md border border-border bg-muted/50 p-2.5 space-y-1">
                  <p className="font-medium text-foreground text-xs">Required scopes:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    <li><code className="bg-muted px-1 py-0.5 rounded">repo</code> — Full repository access (read file trees, contents, branches)</li>
                    <li><code className="bg-muted px-1 py-0.5 rounded">read:org</code> — Read org membership (optional, for org repos)</li>
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-1">For fine-grained tokens: enable <strong>Contents</strong> (read) and <strong>Metadata</strong> (read) permissions.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integrations - Read Only */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Integrations & Connections</CardTitle>
              <CardDescription>Read-only overview of all services powering this project</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={refreshDbStatus} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Refresh status">
                <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${dbStatus === "checking" ? "animate-spin" : ""}`} />
              </button>
              <Badge variant="outline" className={dbStatus === "connected" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : dbStatus === "error" ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-muted text-muted-foreground"}>
                {dbStatus === "checking" ? "Checking…" : dbStatus === "connected" ? "DB Connected" : "DB Error"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {categories.map(cat => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{cat}</h3>
              <div className="space-y-2">
                {INTEGRATIONS.filter(i => i.category === cat).map(integration => (
                  <div key={integration.name} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50">
                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <integration.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{integration.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{integration.description}</p>
                    </div>
                    <Badge variant="outline" className={statusColors[integration.status]}>
                      {integration.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground italic pt-2 border-t border-border">
            This list reflects integrations established during project development. New integrations added manually will not appear here automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
