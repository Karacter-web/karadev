import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Play, Save, Terminal, FileCode, Rocket, Copy, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Lang = "python" | "javascript" | "typescript";
type Snippet = { id: string; title: string; language: string; code: string; last_output: string | null; updated_at: string };

const STARTERS: Record<Lang, string> = {
  python: 'print("hello from karadev sandbox")\nfor i in range(3):\n    print(i)\n',
  javascript: 'console.log("hello from karadev sandbox");\n[1,2,3].forEach(n => console.log(n*n));\n',
  typescript: 'const xs: number[] = [1,2,3];\nconsole.log(xs.map(n => n*n));\n',
};

export default function Sandbox() {
  const [language, setLanguage] = useState<Lang>("python");
  const [code, setCode] = useState(STARTERS.python);
  const [title, setTitle] = useState("Untitled");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [execMs, setExecMs] = useState<number | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [endpointId, setEndpointId] = useState<string | null>(null);
  const [checkingEndpoint, setCheckingEndpoint] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [newEndpointId, setNewEndpointId] = useState<string | null>(null);

  useEffect(() => { load(); checkEndpoint(); }, []);
  useEffect(() => {
    const raw = sessionStorage.getItem("karadev.sandbox.prefill");
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      if (p.title) setTitle(p.title);
      if (p.language) setLanguage(p.language);
      if (typeof p.code === "string") setCode(p.code);
    } catch { /* ignore */ }
    sessionStorage.removeItem("karadev.sandbox.prefill");
  }, []);
  async function load() {
    const { data } = await supabase.from("sandbox_snippets").select("*").order("updated_at", { ascending: false }).limit(50);
    setSnippets((data ?? []) as Snippet[]);
  }

  async function checkEndpoint() {
    setCheckingEndpoint(true);
    try {
      const { data, error } = await supabase.functions.invoke("runpod-setup", { body: {} });
      if (error) throw new Error(error.message);
      setEndpointId((data as any)?.endpointId ?? null);
    } catch {
      setEndpointId(null);
    } finally {
      setCheckingEndpoint(false);
    }
  }

  async function setupRunPod() {
    setSettingUp(true);
    setNewEndpointId(null);
    try {
      const { data, error } = await supabase.functions.invoke("runpod-setup", { body: { create: true } });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (d.error) throw new Error(d.error);
      if (!d.endpointId) throw new Error("No endpointId returned");
      setNewEndpointId(d.endpointId);
      setEndpointId(d.endpointId);
      toast.success(d.created ? "RunPod endpoint created" : "Existing RunPod endpoint found");
    } catch (e: any) {
      toast.error(`RunPod setup failed: ${e.message}`);
    } finally {
      setSettingUp(false);
    }
  }

  async function run() {
    setRunning(true); setOutput(""); setError(""); setExecMs(null);
    try {
      const { data, error: invErr } = await supabase.functions.invoke("runpod-execute", { body: { code, language, timeout: 30 } });
      if (invErr) throw new Error(invErr.message);
      const d = data as any;
      if (d.error && !d.output) setError(d.error); else setOutput(d.output ?? "");
      if (d.error && d.output) setError(d.error);
      setExecMs(d.executionTime ?? null);
      if (currentId) supabase.from("sandbox_snippets").update({ last_output: (d.output ?? "") + (d.error ? `\n[stderr] ${d.error}` : "") }).eq("id", currentId);
    } catch (e: any) { setError(e.message); toast.error(e.message); }
    finally { setRunning(false); }
  }

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    if (currentId) {
      const { error } = await supabase.from("sandbox_snippets").update({ title, language, code }).eq("id", currentId);
      if (error) toast.error(error.message); else toast.success("Saved");
    } else {
      const { data, error } = await supabase.from("sandbox_snippets").insert({ user_id: user.id, title, language, code }).select().single();
      if (error) toast.error(error.message); else { setCurrentId(data.id); toast.success("Saved"); }
    }
    setSaving(false); load();
  }

  function loadSnippet(s: Snippet) {
    setCurrentId(s.id); setTitle(s.title); setLanguage(s.language as Lang); setCode(s.code);
    setOutput(s.last_output ?? ""); setError("");
  }

  function newSnippet() {
    setCurrentId(null); setTitle("Untitled"); setCode(STARTERS[language]); setOutput(""); setError("");
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Terminal className="h-5 w-5 text-primary" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold">Code Sandbox</h1>
          <p className="text-sm text-muted-foreground">Run code in an ephemeral RunPod container. Admin-only.</p>
        </div>
      </div>
      {!checkingEndpoint && !endpointId && (
        <Card className="p-4 border-primary/40 bg-primary/5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Rocket className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <div className="font-medium">RunPod endpoint not configured</div>
                <p className="text-sm text-muted-foreground">
                  Provision a free-tier CPU serverless endpoint (<code>karacterhub-sandbox-free</code>, image <code>runpod/python-node:3.10</code>) using your existing <code>RUNPOD_API_KEY</code>. Python execution requires this; JS/TS already runs via local fallback.
                </p>
              </div>
              <Button onClick={setupRunPod} disabled={settingUp}>
                {settingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
                {settingUp ? "Provisioning…" : "Setup RunPod"}
              </Button>
            </div>
          </div>
        </Card>
      )}
      {newEndpointId && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Endpoint ready — save it as a secret</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-sm">
              Add this as <code>RUNPOD_ENDPOINT_ID</code> in Supabase Edge Function secrets so <code>runpod-execute</code> can route to it.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono">{newEndpointId}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newEndpointId); toast.success("Copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex gap-2 items-center">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs" placeholder="Snippet title" />
            <Select value={language} onValueChange={(v) => { setLanguage(v as Lang); if (!code.trim() || code === STARTERS[language]) setCode(STARTERS[v as Lang]); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="typescript">TypeScript</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save"}</Button>
            <Button onClick={run} disabled={running}>{running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Run</Button>
          </div>
          <textarea
            value={code} onChange={(e) => setCode(e.target.value)}
            className="w-full h-80 font-mono text-sm bg-muted/30 border border-border rounded p-3 focus:outline-none focus:ring-1 focus:ring-primary"
            spellCheck={false}
          />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Output</div>
              {execMs != null && <Badge variant="secondary">{execMs}ms</Badge>}
            </div>
            <pre className="bg-black/90 text-green-300 text-xs p-3 rounded h-48 overflow-auto whitespace-pre-wrap">{output || (running ? "running…" : "(no output yet)")}</pre>
            {error && <pre className="bg-destructive/10 text-destructive text-xs p-3 rounded whitespace-pre-wrap">{error}</pre>}
          </div>
        </Card>
        <Card className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium flex items-center gap-2"><FileCode className="h-4 w-4" /> Snippets</div>
            <Button size="sm" variant="ghost" onClick={newSnippet}>New</Button>
          </div>
          <div className="space-y-1 max-h-[28rem] overflow-auto">
            {snippets.length === 0 && <div className="text-xs text-muted-foreground">No saved snippets.</div>}
            {snippets.map((s) => (
              <button key={s.id} onClick={() => loadSnippet(s)} className={`w-full text-left p-2 rounded text-xs hover:bg-muted ${currentId === s.id ? "bg-muted" : ""}`}>
                <div className="font-medium truncate">{s.title}</div>
                <div className="text-muted-foreground">{s.language} · {new Date(s.updated_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}