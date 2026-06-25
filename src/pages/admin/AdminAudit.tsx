import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Play, Trash2, FileJson, AlertTriangle } from "lucide-react";

type Scan = {
  id: string;
  target: string;
  status: string;
  issues_count: number;
  critical_count: number;
  report: any;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

const TARGETS = [
  { value: "full", label: "Full scan (all categories)" },
  { value: "db", label: "Database only" },
  { value: "code", label: "Codebase only" },
  { value: "infra", label: "Infrastructure only" },
  { value: "config", label: "Configurations only" },
];

const sevColor = (s: string) =>
  s === "critical" ? "bg-destructive text-destructive-foreground" :
  s === "high" ? "bg-orange-600 text-white" :
  s === "medium" ? "bg-yellow-600 text-white" :
  "bg-muted text-muted-foreground";

export default function AdminAudit() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [target, setTarget] = useState("full");
  const [running, setRunning] = useState(false);
  const [viewing, setViewing] = useState<Scan | null>(null);
  const [filterSev, setFilterSev] = useState<string>("all");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [limit, setLimit] = useState(2);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: scanRows }, { data: s }] = await Promise.all([
      supabase.from("audit_scans").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("audit_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    setScans((scanRows ?? []) as Scan[]);
    if (s) { setLimit(s.rate_limit_per_24h); setEnabled(s.enabled); }
  }

  const recent24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const { data: { user } } = { data: { user: null } } as any;
    return scans.filter((s) => new Date(s.created_at).getTime() >= cutoff).length;
  }, [scans]);

  const remaining = Math.max(0, limit - recent24h);
  const nextReset = useMemo(() => {
    if (remaining > 0 || scans.length === 0) return null;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = scans.filter((s) => new Date(s.created_at).getTime() >= cutoff);
    const oldest = recent[recent.length - 1];
    return oldest ? new Date(new Date(oldest.created_at).getTime() + 24 * 60 * 60 * 1000) : null;
  }, [scans, remaining, limit]);

  async function runScan() {
    if (!enabled) { toast.error("Audit scans are disabled"); return; }
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("audit-scan", {
        body: { target, trigger_method: "dashboard" },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Scan complete: ${(data as any).report.summary.total_issues} issues`);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  }

  async function deleteScan(id: string) {
    const { error } = await supabase.from("audit_scans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Report deleted");
    setScans((p) => p.filter((s) => s.id !== id));
  }

  const filteredIssues = useMemo(() => {
    if (!viewing?.report?.results?.errors) return [];
    return (viewing.report.results.errors as any[]).filter((i) =>
      (filterSev === "all" || i.severity === filterSev) &&
      (filterCat === "all" || i.category === filterCat)
    );
  }, [viewing, filterSev, filterCat]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-destructive" /> Audit Scans
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Run a deep scan of the platform. {remaining}/{limit} scans remaining in the next 24h.
            {nextReset && <> Next available: {nextReset.toLocaleString()}.</>}
          </p>
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scan target</label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGETS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={runScan}
            disabled={running || !enabled || remaining <= 0}
            title={!enabled ? "Scans disabled" : remaining <= 0 ? `Limit hit — next: ${nextReset?.toLocaleString()}` : ""}
            size="lg"
          >
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            {target === "full" ? "Run Full Audit Scan" : `Scan ${TARGETS.find((t) => t.value === target)?.label}`}
          </Button>
        </div>
        {!enabled && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> Audit feature disabled in /admin/settings/audit
          </div>
        )}
      </Card>

      <Card>
        <div className="p-4 border-b text-sm font-medium">Scan history</div>
        <div className="divide-y">
          {scans.length === 0 && <div className="p-6 text-sm text-muted-foreground">No scans yet.</div>}
          {scans.map((s) => (
            <div key={s.id} className="p-4 flex items-center gap-3 text-sm">
              <Badge variant="outline" className="font-mono">{s.target}</Badge>
              <Badge className={
                s.status === "complete" ? "bg-emerald-600 text-white" :
                s.status === "failed" ? "bg-destructive text-destructive-foreground" :
                "bg-muted text-muted-foreground"
              }>{s.status}</Badge>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                <div className="text-sm">
                  {s.issues_count} issues
                  {s.critical_count > 0 && <span className="text-destructive font-medium"> · {s.critical_count} critical</span>}
                  {s.error && <span className="text-destructive"> · {s.error}</span>}
                </div>
              </div>
              {s.report && (
                <Button size="sm" variant="outline" onClick={() => { setViewing(s); setFilterSev("all"); setFilterCat("all"); }}>
                  <FileJson className="h-3 w-3 mr-1" /> View
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => deleteScan(s.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Scan report · {viewing?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                {(["critical","high","medium","low"] as const).map((sev) => (
                  <Card key={sev} className="p-3">
                    <div className="text-2xl font-bold">{viewing.report?.summary?.by_severity?.[sev] ?? 0}</div>
                    <div className="text-xs text-muted-foreground uppercase">{sev}</div>
                  </Card>
                ))}
                <Card className="p-3">
                  <div className="text-2xl font-bold">{viewing.report?.summary?.total_issues ?? 0}</div>
                  <div className="text-xs text-muted-foreground uppercase">total</div>
                </Card>
              </div>
              <div className="flex gap-2">
                <Select value={filterSev} onValueChange={setFilterSev}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterCat} onValueChange={setFilterCat}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="codebase">Codebase</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="configurations">Configurations</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="ml-auto"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(viewing.report, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = `audit_${viewing.id}.json`; a.click();
                  }}>
                  Export JSON
                </Button>
              </div>
              <ScrollArea className="h-96 rounded border">
                <div className="divide-y">
                  {filteredIssues.length === 0 && <div className="p-4 text-sm text-muted-foreground">No issues match filters.</div>}
                  {filteredIssues.map((i: any) => (
                    <div key={i.id} className="p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={sevColor(i.severity)}>{i.severity}</Badge>
                        <Badge variant="outline">{i.category}</Badge>
                        <div className="font-medium text-sm">{i.title}</div>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{i.location}</div>
                      <div className="text-sm whitespace-pre-wrap">{i.description}</div>
                      <div className="text-sm text-primary"><strong>Fix:</strong> {i.suggested_fix}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {viewing.report?.warnings?.length > 0 && (
                <Card className="p-3 bg-yellow-500/10 border-yellow-500/40">
                  <div className="text-xs font-medium mb-1">Warnings</div>
                  <ul className="text-xs space-y-1">
                    {viewing.report.warnings.map((w: string, i: number) => <li key={i}>· {w}</li>)}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}