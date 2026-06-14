import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { CheckSquare, Plus, Circle, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];

const statusConfig: Record<TaskStatus, { icon: any; label: string; color: string }> = {
  pending: { icon: Circle, label: "Pending", color: "text-muted-foreground" },
  in_progress: { icon: Clock, label: "In Progress", color: "text-warning" },
  done: { icon: CheckCircle, label: "Done", color: "text-success" },
};

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWs, setSelectedWs] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [{ data: ws }, { data: t }] = await Promise.all([
      supabase.from("workspaces").select("*"),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    ]);
    setWorkspaces(ws || []);
    setTasks(t || []);
    if (ws?.length && !selectedWs) setSelectedWs(ws[0].id);
  };

  const createTask = async () => {
    if (!title.trim() || !selectedWs || !user) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        title, description, workspace_id: selectedWs, created_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Task created!" });
      setTitle(""); setDescription(""); setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    await supabase.from("tasks").update({ status }).eq("id", taskId);
    fetchData();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Tasks</h1>
          <p className="text-muted-foreground mt-1 text-sm">Track work from AI suggestions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
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
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details..." />
              </div>
              <Button onClick={createTask} disabled={creating} className="w-full">
                {creating ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <CheckSquare className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No tasks yet. Create one or generate from AI chat.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const sc = statusConfig[task.status as TaskStatus];
            return (
              <Card key={task.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <sc.icon className={cn("h-5 w-5 shrink-0", sc.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{task.title}</p>
                      {task.description && <p className="text-xs text-muted-foreground truncate">{task.description}</p>}
                    </div>
                  </div>
                  <Select value={task.status} onValueChange={(v) => updateStatus(task.id, v as TaskStatus)}>
                    <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
