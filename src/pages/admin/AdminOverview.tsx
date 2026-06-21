import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, MessageSquare, GitBranch, ClipboardList, Activity } from "lucide-react";

interface Stats {
  users: number;
  workspaces: number;
  conversations: number;
  repositories: number;
  prompts: number;
  auditLogs: number;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const counts = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("workspaces").select("*", { count: "exact", head: true }),
        supabase.from("conversations").select("*", { count: "exact", head: true }),
        supabase.from("repositories").select("*", { count: "exact", head: true }),
        supabase.from("prompt_templates").select("*", { count: "exact", head: true }),
        supabase.from("ai_audit_logs").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        users: counts[0].count ?? 0,
        workspaces: counts[1].count ?? 0,
        conversations: counts[2].count ?? 0,
        repositories: counts[3].count ?? 0,
        prompts: counts[4].count ?? 0,
        auditLogs: counts[5].count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "Users", value: stats?.users, icon: Users },
    { label: "Workspaces", value: stats?.workspaces, icon: Building2 },
    { label: "Conversations", value: stats?.conversations, icon: MessageSquare },
    { label: "Repositories", value: stats?.repositories, icon: GitBranch },
    { label: "Prompt templates", value: stats?.prompts, icon: ClipboardList },
    { label: "AI audit events", value: stats?.auditLogs, icon: Activity },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform-wide metrics for the Karadev deployment.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">
                {c.value ?? <span className="text-muted-foreground/40">…</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}