import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Moon, Sun, Database, Shield, Cloud, Key, Cpu, Globe, Radio, GitBranch, RefreshCw, Eye, EyeOff, Check, Github, Trash2, AlertTriangle, Copy, Plus, Terminal } from "lucide-react";
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
import ConnectorsSection from "@/components/ConnectorsSection";

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "error">("checking");
  const [ghToken, setGhToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [hasStoredToken, setHasStoredToken] = useState(false);

  // Workspace admin state
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWs, setActiveWs] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [wsName, setWsName] = useState("");
  const [savingWs, setSavingWs] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // API keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

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

  // Load workspaces user is a member of, pick first admin one
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("workspace_members")
        .select("role, workspace:workspace_id(id, name, slug, owner_id)")
        .eq("user_id", user.id);
      const rows = (data || []).map((r: any) => ({ ...r.workspace, role: r.role })).filter(Boolean);
      setWorkspaces(rows);
      const adminWs = rows.find((w: any) => w.role === "admin") || rows[0];
      if (adminWs) {
        setActiveWs(adminWs);
        setIsAdmin(adminWs.role === "admin");
        setWsName(adminWs.name);
      }
    })();
  }, [user]);

  // Load API keys for active workspace
  useEffect(() => {
    if (!activeWs?.id || !isAdmin) { setApiKeys([]); return; }
    (async () => {
      const { data } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, created_at, last_used_at, revoked_at, expires_at")
        .eq("workspace_id", activeWs.id)
        .order("created_at", { ascending: false });
      setApiKeys(data || []);
    })();
  }, [activeWs, isAdmin, generatedKey]);

  const renameWorkspace = async () => {
    if (!activeWs || !wsName.trim() || wsName === activeWs.name) return;
    setSavingWs(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ name: wsName.trim() })
      .eq("id", activeWs.id);
    setSavingWs(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Workspace renamed" });
    setActiveWs({ ...activeWs, name: wsName.trim() });
  };

  const deleteWorkspace = async () => {
    if (!activeWs || deleteConfirm !== activeWs.name) return;
    setDeleting(true);
    const { error } = await supabase.from("workspaces").delete().eq("id", activeWs.id);
    if (error) {
      setDeleting(false);
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Workspace deleted" });
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const createApiKey = async () => {
    if (!activeWs || !user || !newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      // Generate a 32-byte random token, hex-encoded
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const raw = "kdv_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      const key_hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const key_prefix = raw.slice(0, 12);
      const { error } = await supabase.from("api_keys").insert({
        workspace_id: activeWs.id,
        created_by: user.id,
        name: newKeyName.trim(),
        key_hash,
        key_prefix,
      });
      if (error) throw error;
      setGeneratedKey(raw);
      setNewKeyName("");
      toast({ title: "API key created", description: "Copy it now — it won't be shown again." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreatingKey(false);
    }
  };

  const revokeApiKey = async (id: string) => {
    const { error } = await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setApiKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k)));
    toast({ title: "API key revoked" });
  };

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

      {/* Workspace Settings (admins only) */}
      {activeWs && isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workspace Settings</CardTitle>
                <CardDescription>Manage <strong>{activeWs.name}</strong> — admin only</CardDescription>
              </div>
              {workspaces.length > 1 && (
                <select
                  value={activeWs.id}
                  onChange={(e) => {
                    const w = workspaces.find((x: any) => x.id === e.target.value);
                    if (w) { setActiveWs(w); setIsAdmin(w.role === "admin"); setWsName(w.name); }
                  }}
                  className="text-xs bg-muted border border-border rounded px-2 py-1"
                >
                  {workspaces.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Workspace name</Label>
              <div className="flex gap-2">
                <Input value={wsName} onChange={(e) => setWsName(e.target.value)} />
                <Button onClick={renameWorkspace} disabled={savingWs || !wsName.trim() || wsName === activeWs.name}>
                  {savingWs ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={activeWs.slug || ""} readOnly className="font-mono text-xs bg-muted/40" />
            </div>

            {/* API Keys */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <p className="text-sm font-medium">API Keys</p>
                <p className="text-xs text-muted-foreground">Used by the /embed route and the VS Code extension to authenticate as this workspace.</p>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Key name (e.g. VS Code, Embed)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
                <Button onClick={createApiKey} disabled={creatingKey || !newKeyName.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Create
                </Button>
              </div>
              {generatedKey && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-medium">Copy this key now — it won't be shown again.</p>
                  <div className="flex gap-2">
                    <Input readOnly value={generatedKey} className="font-mono text-xs" />
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(generatedKey); toast({ title: "Copied" }); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setGeneratedKey(null)}>Done</Button>
                </div>
              )}
              <div className="space-y-2">
                {apiKeys.length === 0 && <p className="text-xs text-muted-foreground italic">No keys yet.</p>}
                {apiKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card/40">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{k.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{k.key_prefix}…</p>
                    </div>
                    {k.revoked_at ? (
                      <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">Revoked</Badge>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => revokeApiKey(k.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-sm font-semibold text-destructive">Danger zone</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Deleting <strong>{activeWs.name}</strong> permanently removes all conversations, tasks, prompts, repositories, and API keys. This cannot be undone.
              </p>
              <div className="space-y-2">
                <Label className="text-xs">Type <code className="font-mono">{activeWs.name}</code> to confirm</Label>
                <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={activeWs.name} />
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteConfirm !== activeWs.name || deleting}
                onClick={deleteWorkspace}
              >
                {deleting ? "Deleting…" : "Delete workspace"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connectors — per-user provider integrations (GitHub, Supabase, Vercel, Netlify, Google, Lovable) */}
      {user && <ConnectorsSection userId={user.id} />}

      {/* API Integration — developer docs for using workspace API keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>API Integration</CardTitle>
              <CardDescription>
                Integrate Karadev's AI chat into your own project. A workspace API key
                authenticates the request and <strong>bypasses</strong> the per-user daily limit
                and JWT requirement — no user session needed.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Endpoint</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`}
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`);
                  toast({ title: "Endpoint copied" });
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Headers</Label>
            <pre className="text-[11px] font-mono bg-muted/60 border border-border rounded-md p-3 overflow-x-auto">
{`Content-Type: application/json
x-api-key: kdv_••••••••••••••••   ← your workspace API key`}
            </pre>
            <p className="text-[11px] text-muted-foreground">
              Generate a key above. Send it as <code className="font-mono bg-muted px-1 rounded">x-api-key</code>;
              the server hashes &amp; matches it, then accepts the request without a Supabase JWT.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">cURL example</Label>
            <div className="relative">
              <pre className="text-[11px] font-mono bg-muted/60 border border-border rounded-md p-3 overflow-x-auto">
{`curl -N ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: kdv_YOUR_KEY_HERE" \\
  -d '{
    "messages": [
      { "role": "user", "content": "Explain async/await in TypeScript" }
    ]
  }'`}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => {
                  const snippet = `curl -N ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: kdv_YOUR_KEY_HERE" \\\n  -d '{\n    "messages": [\n      { "role": "user", "content": "Explain async/await in TypeScript" }\n    ]\n  }'`;
                  navigator.clipboard.writeText(snippet);
                  toast({ title: "cURL copied" });
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">JavaScript / fetch</Label>
            <pre className="text-[11px] font-mono bg-muted/60 border border-border rounded-md p-3 overflow-x-auto">
{`const res = await fetch("${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.KARADEV_API_KEY!,
  },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Hello" }],
  }),
});
// Response is an SSE stream (text/event-stream) — read with res.body.getReader()`}
            </pre>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-300/90 space-y-1">
            <p className="font-medium flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Keep keys server-side</p>
            <p>Never embed an API key in browser JavaScript or commit it to git. Use environment variables in your backend / edge function and call the endpoint from there.</p>
          </div>
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
