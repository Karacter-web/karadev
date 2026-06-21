import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminAudit() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ai_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">Latest 200 AI invocations across the platform.</p>
      </div>
      <Card className="divide-y">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && <div className="p-6 text-sm text-muted-foreground">No audit events.</div>}
        {rows.map((r) => (
          <div key={r.id} className="p-4 flex items-center gap-3 text-sm">
            <Badge variant="outline">{r.source ?? "unknown"}</Badge>
            <div className="flex-1 min-w-0 truncate font-mono text-xs">
              {r.model ?? "—"} · {r.tokens_used ?? 0} tokens · user {String(r.user_id ?? "").slice(0, 8)}…
            </div>
            <div className="text-xs text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleString()}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}