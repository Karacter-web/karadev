import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export default function AdminWorkspaces() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("workspaces").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this workspace and all its data?")) return;
    const { error } = await supabase.from("workspaces").delete().eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Workspace deleted" });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Workspaces</h1>
        <p className="text-muted-foreground text-sm mt-1">All workspaces on this Karadev deployment.</p>
      </div>
      <Card className="divide-y">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && <div className="p-6 text-sm text-muted-foreground">No workspaces.</div>}
        {rows.map((w) => (
          <div key={w.id} className="flex items-center gap-4 p-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{w.name}</div>
              <div className="text-xs text-muted-foreground font-mono truncate">{w.slug ?? w.id} · owner {String(w.owner_id).slice(0,8)}…</div>
            </div>
            <div className="text-xs text-muted-foreground hidden md:block">{new Date(w.created_at).toLocaleDateString()}</div>
            <Button size="sm" variant="outline" onClick={() => remove(w.id)}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
          </div>
        ))}
      </Card>
    </div>
  );
}