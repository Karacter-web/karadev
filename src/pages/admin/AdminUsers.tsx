import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Shield, ShieldOff } from "lucide-react";

interface Row {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: string[];
}

export default function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, avatar_url, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string[]>();
    (rolesRes.data ?? []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    setRows(
      (profilesRes.data ?? []).map((p: any) => ({
        ...p,
        roles: roleMap.get(p.user_id) ?? [],
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    if (currentlyAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) {
        toast({ title: "Failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Admin revoked" });
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) {
        toast({ title: "Failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Admin granted" });
    }
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage platform users and grant administrator privileges.</p>
      </div>
      <Card className="divide-y">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && <div className="p-6 text-sm text-muted-foreground">No users yet.</div>}
        {rows.map((r) => {
          const isAdmin = r.roles.includes("admin");
          return (
            <div key={r.user_id} className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-medium">
                {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : (r.display_name?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.display_name || "Unnamed user"}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">{r.user_id}</div>
              </div>
              <div className="flex items-center gap-2">
                {r.roles.map((role) => (
                  <Badge key={role} variant={role === "admin" ? "default" : "secondary"}>{role}</Badge>
                ))}
              </div>
              <Button size="sm" variant={isAdmin ? "outline" : "default"} onClick={() => toggleAdmin(r.user_id, isAdmin)}>
                {isAdmin ? <><ShieldOff className="h-4 w-4 mr-1" /> Revoke</> : <><Shield className="h-4 w-4 mr-1" /> Make admin</>}
              </Button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}