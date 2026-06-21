import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export default function AdminPrompts() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("prompt_templates").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this prompt template?")) return;
    const { error } = await supabase.from("prompt_templates").delete().eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Prompt deleted" });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Prompt Library</h1>
        <p className="text-muted-foreground text-sm mt-1">Moderate prompts published across the platform.</p>
      </div>
      <Card className="divide-y">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && <div className="p-6 text-sm text-muted-foreground">No prompts.</div>}
        {rows.map((p) => (
          <div key={p.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.title}</div>
                {p.category && <Badge variant="secondary" className="mt-1">{p.category}</Badge>}
              </div>
              <Button size="sm" variant="outline" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{p.content}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}