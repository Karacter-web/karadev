import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { BookTemplate, Plus, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/SEO";

export default function Prompts() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWs, setSelectedWs] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [{ data: ws }, { data: t }] = await Promise.all([
      supabase.from("workspaces").select("*"),
      supabase.from("prompt_templates").select("*").order("created_at", { ascending: false }),
    ]);
    setWorkspaces(ws || []);
    setTemplates(t || []);
    if (ws?.length && !selectedWs) setSelectedWs(ws[0].id);
  };

  const createTemplate = async () => {
    if (!title.trim() || !content.trim() || !selectedWs || !user) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("prompt_templates").insert({
        title,
        content,
        workspace_id: selectedWs,
        created_by: user.id,
        category: category.trim() || null,
      } as any);
      if (error) throw error;
      toast({ title: "Template saved!" });
      setTitle(""); setContent(""); setCategory(""); setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const categories = Array.from(
    new Set(templates.map((t: any) => t.category).filter(Boolean))
  ) as string[];
  const visibleTemplates = activeCategory === "All"
    ? templates
    : templates.filter((t: any) => (t.category || "Uncategorized") === activeCategory);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <SEO title={"Prompt Library — Karadev"} description={"Reusable AI prompt templates for your Karadev workspace."} path={"/dashboard/prompts"} noindex />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Prompt Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm">Reusable prompts for your team</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New Template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Workspace</Label>
                <Select value={selectedWs} onValueChange={setSelectedWs}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Code Review Request" />
              </div>
              <div className="space-y-2">
                <Label>Prompt Content</Label>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your reusable prompt..." rows={5} />
              </div>
              <div className="space-y-2">
                <Label>Category (optional)</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Code Review, Debugging, Docs" />
              </div>
              <Button onClick={createTemplate} disabled={creating} className="w-full">
                {creating ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category filter tabs */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(["All", ...categories] as string[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {visibleTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <BookTemplate className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {templates.length === 0
                ? "No templates yet. Save your best prompts for reuse."
                : `No templates in "${activeCategory}".`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {visibleTemplates.map((t: any) => (
            <Card key={t.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{t.title}</h3>
                    {t.category && <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t.category}</p>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(t.content); toast({ title: "Copied!" }); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">{t.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
