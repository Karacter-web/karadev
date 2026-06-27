import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { GitBranch, Plus, ExternalLink, FolderOpen } from "lucide-react";
import GitHubFileBrowser from "@/components/GitHubFileBrowser";
import { SEO } from "@/components/SEO";

export default function Repos() {
  const { user } = useAuth();
  const [repos, setRepos] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWs, setSelectedWs] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [browsingRepo, setBrowsingRepo] = useState<{ fullName: string; branch: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: ws }, { data: r }] = await Promise.all([
      supabase.from("workspaces").select("*"),
      supabase.from("repositories").select("*, workspaces(name)"),
    ]);
    setWorkspaces(ws || []);
    setRepos(r || []);
    if (ws?.length && !selectedWs) setSelectedWs(ws[0].id);
  };

  const addRepo = async () => {
    if (!repoName.trim() || !repoUrl.trim() || !selectedWs) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("repositories").insert({
        workspace_id: selectedWs,
        github_repo_full_name: repoName,
        github_repo_url: repoUrl,
      });
      if (error) throw error;
      toast({ title: "Repository connected!" });
      setRepoName(""); setRepoUrl(""); setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  if (browsingRepo) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <SEO title={"Repositories — Karadev"} description={"Connect GitHub repositories to Karadev so the AI can read your codebase."} path={"/dashboard/repos"} noindex />
        <GitHubFileBrowser
          repoFullName={browsingRepo.fullName}
          defaultBranch={browsingRepo.branch}
          onClose={() => setBrowsingRepo(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Repositories</h1>
          <p className="text-muted-foreground mt-1 text-sm">Connect and manage your GitHub repos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Connect Repo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Connect Repository</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Workspace</Label>
                <Select value={selectedWs} onValueChange={setSelectedWs}>
                  <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Repository Name</Label>
                <Input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="owner/repo" />
              </div>
              <div className="space-y-2">
                <Label>Repository URL</Label>
                <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" />
              </div>
              <Button onClick={addRepo} disabled={adding} className="w-full">
                {adding ? "Connecting..." : "Connect Repository"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {repos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 sm:p-8 text-center">
            <GitBranch className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No repositories connected yet.</p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Connect Your First Repo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {repos.map((repo) => (
            <Card key={repo.id} className="hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{repo.github_repo_full_name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{repo.description || "No description"}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBrowsingRepo({ fullName: repo.github_repo_full_name, branch: repo.default_branch || "main" })}
                  >
                    <FolderOpen className="h-3 w-3 mr-1" /> Browse
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={repo.github_repo_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> GitHub
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}