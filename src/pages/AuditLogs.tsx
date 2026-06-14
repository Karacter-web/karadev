import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Star, Search, FileText, Bot, Calendar } from "lucide-react";
import { format } from "date-fns";

const AGENT_SOURCES = ["lovable", "cursor", "windsurf", "copilot", "other"] as const;
type AgentSource = typeof AGENT_SOURCES[number];

const agentColors: Record<AgentSource, string> = {
  lovable: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  cursor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  windsurf: "bg-green-500/10 text-green-400 border-green-500/20",
  copilot: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  other: "bg-muted text-muted-foreground border-border",
};

export default function AuditLogs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    agent_source: "lovable" as AgentSource,
    model_name: "",
    prompt: "",
    response: "",
    tags: "",
    rating: 0,
    notes: "",
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", filterAgent],
    queryFn: async () => {
      const q = supabase
        .from("ai_audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false });
      
      if (filterAgent !== "all") {
        q.eq("agent_source", filterAgent);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const addLog = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_audit_logs" as any).insert({
        user_id: user?.id,
        agent_source: form.agent_source,
        model_name: form.model_name || null,
        prompt: form.prompt,
        response: form.response || null,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
        rating: form.rating || null,
        notes: form.notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      toast.success("Audit log entry added");
      setDialogOpen(false);
      setForm({ agent_source: "lovable", model_name: "", prompt: "", response: "", tags: "", rating: 0, notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = logs.filter((l: any) =>
    !search || l.prompt?.toLowerCase().includes(search.toLowerCase()) || l.response?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Track conversations across AI coding agents for audit & improvement</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Entry</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Audit Log Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">Agent</label>
                  <Select value={form.agent_source} onValueChange={(v) => setForm({ ...form, agent_source: v as AgentSource })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AGENT_SOURCES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Model</label>
                  <Input placeholder="e.g. gpt-5" value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Prompt *</label>
                <Textarea rows={3} placeholder="The prompt sent to the AI..." value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Response</label>
                <Textarea rows={4} placeholder="The AI response..." value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">Tags (comma-separated)</label>
                  <Input placeholder="bug-fix, refactor" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Rating (1-5)</label>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setForm({ ...form, rating: n })} className="p-1">
                        <Star className={`h-5 w-5 ${form.rating >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Notes</label>
                <Input placeholder="Any additional notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button onClick={() => addLog.mutate()} disabled={!form.prompt || addLog.isPending} className="w-full">
                {addLog.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search prompts & responses..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterAgent} onValueChange={setFilterAgent}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All agents" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {AGENT_SOURCES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {AGENT_SOURCES.slice(0, 4).map((agent) => {
          const count = logs.filter((l: any) => l.agent_source === agent).length;
          return (
            <Card key={agent} className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground capitalize">{agent}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Log entries */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No audit logs yet. Add your first entry to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-3">
            {filtered.map((log: any) => (
              <Card key={log.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={agentColors[log.agent_source as AgentSource] || agentColors.other}>
                        <Bot className="h-3 w-3 mr-1" />
                        {log.agent_source}
                      </Badge>
                      {log.model_name && <Badge variant="secondary" className="text-xs">{log.model_name}</Badge>}
                      {log.tags?.map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {log.rating && (
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={`h-3 w-3 ${log.rating >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                          ))}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(log.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-foreground font-medium mb-1 line-clamp-2">{log.prompt}</p>
                  {log.response && <p className="text-xs text-muted-foreground line-clamp-2">{log.response}</p>}
                  {log.notes && <p className="text-xs text-muted-foreground/70 mt-1 italic">{log.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
