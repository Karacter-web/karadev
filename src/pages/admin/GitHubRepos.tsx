import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Github, Loader2, Plus, GitFork, ExternalLink, RefreshCw } from "lucide-react";

type Repo = { name: string; url: string; private: boolean; description: string | null; default_branch: string; updated_at: string };

export default function GitHubRepos() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  // clone form
  const [cloneUrl, setCloneUrl] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("github-list-repos");
    if (error || (data as any)?.error) toast.error(error?.message ?? (data as any)?.error);
    else setRepos((data as any).repos ?? []);
    setLoading(false);
  }

  async function createRepo() {
    if (!name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("github-create-repo", { body: { name, description, private: isPrivate } });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error(error?.message ?? (data as any)?.error);
    toast.success(`Created ${(data as any).repoName}`);
    setCreateOpen(false); setName(""); setDescription(""); setIsPrivate(false); load();
  }

  async function cloneRepo() {
    if (!cloneUrl.trim()) { toast.error("URL required"); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("github-clone-repo", { body: { repoUrl: cloneUrl, newName: newName || undefined } });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error(error?.message ?? (data as any)?.error);
    toast.success(`Cloned to ${(data as any).clonedRepoName} (${(data as any).files_count} files)`);
    setCloneOpen(false); setCloneUrl(""); setNewName(""); load();
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Github className="h-5 w-5 text-primary" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold">GitHub Repos</h1>
          <p className="text-sm text-muted-foreground">Manage repositories under the Karacterhub GitHub App installation.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        <Button variant="outline" onClick={() => setCloneOpen(true)}><GitFork className="h-4 w-4 mr-2" />Clone</Button>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />New repo</Button>
      </div>

      <Card>
        <div className="divide-y">
          {loading && <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
          {!loading && repos.length === 0 && <div className="p-6 text-sm text-muted-foreground">No repos accessible to the GitHub App.</div>}
          {repos.map((r) => (
            <div key={r.name} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{r.name}</div>
                  {r.private && <Badge variant="secondary">private</Badge>}
                  <Badge variant="outline" className="font-mono text-[10px]">{r.default_branch}</Badge>
                </div>
                {r.description && <div className="text-xs text-muted-foreground truncate">{r.description}</div>}
              </div>
              <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                Open <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create repository</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-new-repo" /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={isPrivate} onCheckedChange={setIsPrivate} /><Label>Private</Label></div>
          </div>
          <DialogFooter><Button onClick={createRepo} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clone repository</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Source GitHub URL</Label><Input value={cloneUrl} onChange={(e) => setCloneUrl(e.target.value)} placeholder="https://github.com/owner/repo" /></div>
            <div className="space-y-1"><Label>New name (optional)</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="auto-generated if blank" /></div>
          </div>
          <DialogFooter><Button onClick={cloneRepo} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Clone</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}