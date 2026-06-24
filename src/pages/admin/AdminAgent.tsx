import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bot, Github, Loader2, Sparkles, ExternalLink, FileCode } from "lucide-react";

type Stage = "idle" | "analyzing" | "scaffolding" | "deploying" | "done" | "error";

type Run = {
  id: string;
  prompt: string;
  source_url: string | null;
  status: string;
  stage: string | null;
  github_repo_url: string | null;
  github_repo_name: string | null;
  files_count: number;
  error: string | null;
  created_at: string;
};

export default function AdminAgent() {
  const [prompt, setPrompt] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [analysis, setAnalysis] = useState("");
  const [files, setFiles] = useState<{ path: string; content: string }[]>([]);
  const [result, setResult] = useState<{ repo_url: string; repo_name: string } | null>(null);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  useEffect(() => { loadRuns(); }, []);

  async function loadRuns() {
    const { data } = await supabase
      .from("generated_projects")
      .select("id,prompt,source_url,status,stage,github_repo_url,github_repo_name,files_count,error,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setRuns((data ?? []) as Run[]);
  }

  async function logStage(id: string, status: string, patch: Record<string, unknown>) {
    await supabase.from("generated_projects").update({ status, ...patch }).eq("id", id);
  }

  async function run() {
    if (!prompt.trim()) { toast.error("Enter a prompt"); return; }
    setError(""); setAnalysis(""); setFiles([]); setResult(null); setStage("analyzing");

    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) { toast.error("Not signed in"); setStage("error"); return; }

    const { data: row, error: insErr } = await supabase
      .from("generated_projects")
      .insert({ admin_user_id: uid, prompt, source_url: sourceUrl || null, status: "analyzing", stage: "analyze" })
      .select("id").single();
    if (insErr || !row) { setError(insErr?.message ?? "insert failed"); setStage("error"); return; }
    setActiveRunId(row.id);

    try {
      // 1. Analyze
      const a = await supabase.functions.invoke("agent-analyze", { body: { prompt, source_url: sourceUrl || undefined } });
      if (a.error) throw new Error(a.error.message);
      const analysisText = (a.data as any).analysis as string;
      setAnalysis(analysisText);
      await logStage(row.id, "scaffolding", { analysis: analysisText, analysis_model: (a.data as any).model, stage: "scaffold" });

      // 2. Scaffold
      setStage("scaffolding");
      const s = await supabase.functions.invoke("agent-scaffold", { body: { prompt, analysis: analysisText } });
      if (s.error) throw new Error(s.error.message);
      const sd = s.data as any;
      setFiles(sd.files);
      await logStage(row.id, "deploying", { scaffold_model: sd.model, files_count: sd.files.length, stage: "deploy" });

      // 3. Deploy
      setStage("deploying");
      const d = await supabase.functions.invoke("agent-deploy", {
        body: { project_name: sd.project_name, description: sd.description, files: sd.files },
      });
      if (d.error) throw new Error(d.error.message);
      const dd = d.data as any;
      setResult({ repo_url: dd.repo_url, repo_name: dd.repo_name });
      await logStage(row.id, "done", { github_repo_url: dd.repo_url, github_repo_name: dd.repo_name, stage: "done" });
      setStage("done");
      toast.success(`Deployed to ${dd.repo_name}`);
      loadRuns();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg); setStage("error");
      await logStage(row.id, "error", { error: msg, stage: "error" });
      toast.error(msg);
      loadRuns();
    }
  }

  const stageLabel: Record<Stage, string> = {
    idle: "Ready",
    analyzing: "Analyzing with Mistral…",
    scaffolding: "Generating code with DeepSeek…",
    deploying: "Pushing to GitHub…",
    done: "Deployed",
    error: "Failed",
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Build Agent</h1>
          <p className="text-sm text-muted-foreground">Generate a project from a prompt — auto-deploy under the Karacterhub GitHub app.</p>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Prompt</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Build an HRM project with employee onboarding, payroll module, and React + Express + Postgres stack."
            rows={5}
            disabled={stage !== "idle" && stage !== "done" && stage !== "error"}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Source repo / URL (optional)</label>
          <Input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://github.com/owner/repo  — agent will clone, analyze, and extend"
            disabled={stage !== "idle" && stage !== "done" && stage !== "error"}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {(stage === "analyzing" || stage === "scaffolding" || stage === "deploying") && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            <Badge variant={stage === "error" ? "destructive" : stage === "done" ? "default" : "secondary"}>{stageLabel[stage]}</Badge>
          </div>
          <Button onClick={run} disabled={stage === "analyzing" || stage === "scaffolding" || stage === "deploying"}>
            <Sparkles className="h-4 w-4 mr-2" /> Run agent
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <div className="text-sm text-destructive font-mono whitespace-pre-wrap break-all">{error}</div>
        </Card>
      )}

      {analysis && (
        <Card className="p-6 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> Analysis (Mistral)</div>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/40 p-4 rounded-lg max-h-72 overflow-auto">{analysis}</pre>
        </Card>
      )}

      {files.length > 0 && (
        <Card className="p-6 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium"><FileCode className="h-4 w-4 text-primary" /> Generated files ({files.length})</div>
          <div className="text-xs font-mono space-y-1 max-h-60 overflow-auto">
            {files.map((f) => (
              <div key={f.path} className="flex items-center justify-between gap-4 py-1 border-b border-border/40 last:border-0">
                <span className="truncate">{f.path}</span>
                <span className="text-muted-foreground shrink-0">{f.content.length} chars</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-6 border-primary/40 bg-primary/5">
          <div className="flex items-center gap-3">
            <Github className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{result.repo_name}</div>
              <div className="text-xs text-muted-foreground">Deployed via Karacterhub GitHub App</div>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href={result.repo_url} target="_blank" rel="noreferrer">Open repo <ExternalLink className="h-3 w-3 ml-1" /></a>
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="text-sm font-medium mb-3">Recent runs</div>
        {runs.length === 0 ? (
          <div className="text-sm text-muted-foreground">No runs yet.</div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{r.prompt}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.files_count} files</div>
                </div>
                <Badge variant={r.status === "done" ? "default" : r.status === "error" ? "destructive" : "secondary"}>{r.status}</Badge>
                {r.github_repo_url && (
                  <a href={r.github_repo_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline shrink-0">repo</a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}