import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import { GitBranch, MessageSquare, CheckSquare, Users, Plus, ArrowRight, Activity } from "lucide-react";
import { SEO } from "@/components/SEO";

type ActivityItem = {
  id: string;
  kind: "message" | "task" | "repo";
  label: string;
  detail: string;
  created_at: string;
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [newWsName, setNewWsName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ repos: 0, conversations: 0, tasks: 0, members: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchActivity, 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: ws }, { count: repoCount }, { count: convCount }, { count: taskCount }, { count: memberCount }] = await Promise.all([
      supabase.from("workspaces").select("*, workspace_members(count)"),
      supabase.from("repositories").select("*", { count: "exact", head: true }),
      supabase.from("conversations").select("*", { count: "exact", head: true }),
      supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done"),
      supabase.from("workspace_members").select("*", { count: "exact", head: true }),
    ]);
    setWorkspaces(ws || []);
    setStats({
      repos: repoCount || 0,
      conversations: convCount || 0,
      tasks: taskCount || 0,
      members: memberCount || 0,
    });
    setLoading(false);
    fetchActivity();
  };

  const fetchActivity = async () => {
    const [{ data: msgs }, { data: ts }, { data: rs }] = await Promise.all([
      supabase
        .from("messages")
        .select("id, content, created_at, role, user_id")
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("tasks")
        .select("id, title, created_at, created_by")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("repositories")
        .select("id, github_repo_full_name, connected_at")
        .order("connected_at", { ascending: false })
        .limit(20),
    ]);

    // Resolve display names for the users involved
    const userIds = Array.from(new Set([
      ...(msgs || []).map((m: any) => m.user_id).filter(Boolean),
      ...(ts || []).map((t: any) => t.created_by).filter(Boolean),
    ])) as string[];
    const nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      (profs || []).forEach((p: any) => nameMap.set(p.user_id, p.display_name || "Someone"));
    }

    const items: ActivityItem[] = [];
    (msgs || []).forEach((m: any) => items.push({
      id: `m-${m.id}`,
      kind: "message",
      label: `${nameMap.get(m.user_id) || "Someone"} asked Karacter`,
      detail: (m.content || "").slice(0, 120),
      created_at: m.created_at,
    }));
    (ts || []).forEach((t: any) => items.push({
      id: `t-${t.id}`,
      kind: "task",
      label: `${nameMap.get(t.created_by) || "Someone"} created task`,
      detail: t.title,
      created_at: t.created_at,
    }));
    (rs || []).forEach((r: any) => items.push({
      id: `r-${r.id}`,
      kind: "repo",
      label: "Repository connected",
      detail: r.github_repo_full_name,
      created_at: r.connected_at,
    }));

    items.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    setActivity(items.slice(0, 20));
  };

  const createWorkspace = async () => {
    if (!newWsName.trim() || !user) return;
    setCreating(true);
    try {
      const { data: ws, error } = await supabase.from("workspaces").insert({ name: newWsName, owner_id: user.id }).select().single();
      if (error) throw error;
      await supabase.from("workspace_members").insert({ workspace_id: ws.id, user_id: user.id, role: "admin" as const });
      toast({ title: "Workspace created!" });
      setNewWsName("");
      setDialogOpen(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  const statCards = [
    { icon: GitBranch, label: "Repositories", value: stats.repos, path: "/dashboard/repos" },
    { icon: MessageSquare, label: "Conversations", value: stats.conversations, path: "/dashboard/chat" },
    { icon: CheckSquare, label: "Active Tasks", value: stats.tasks, path: "/dashboard/tasks" },
    { icon: Users, label: "Team Members", value: stats.members, path: "/dashboard/team" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      <SEO title={"Dashboard — Karadev"} description={"Workspace overview, recent activity, repos, and quick actions for your Karadev team."} path={"/dashboard"} noindex />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome back, {user?.user_metadata?.full_name || user?.email}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New Workspace</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Workspace Name</Label>
                <Input value={newWsName} onChange={(e) => setNewWsName(e.target.value)} placeholder="My Team" />
              </div>
              <Button onClick={createWorkspace} disabled={creating} className="w-full">
                {creating ? "Creating..." : "Create Workspace"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate(s.path)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <s.icon className="h-5 w-5 text-muted-foreground" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Workspaces */}
      <div>
        <h2 className="text-xl font-display font-semibold mb-4">Your Workspaces</h2>
        {workspaces.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No workspaces yet. Create one to get started.</p>
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create Workspace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
              <Card key={ws.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate(`/dashboard/chat?workspace=${ws.id}`)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{ws.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Created {new Date(ws.created_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Team Activity Feed */}
      <div>
        <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Team Activity
        </h2>
        {activity.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No recent activity yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {activity.map((a) => {
                const Icon = a.kind === "message" ? MessageSquare : a.kind === "task" ? CheckSquare : GitBranch;
                return (
                  <div key={a.id} className="flex items-start gap-3 p-3 sm:p-4">
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
