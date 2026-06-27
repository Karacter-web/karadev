import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Code, Eye } from "lucide-react";
import { SEO } from "@/components/SEO";

const roleIcons = { admin: Crown, developer: Code, viewer: Eye };

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: ws } = await supabase.from("workspaces").select("*");
    setWorkspaces(ws || []);
    if (ws?.length) {
      const { data: m } = await supabase
        .from("workspace_members")
        .select("*, profiles(display_name, avatar_url)")
        .eq("workspace_id", ws[0].id);
      setMembers(m || []);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <SEO title={"Team — Karadev"} description={"Manage workspace members, roles, and collaboration in Karadev."} path={"/dashboard/team"} noindex />
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Team</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your workspace members</p>
      </div>

      {members.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Create a workspace first to manage team members.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const RoleIcon = roleIcons[m.role as keyof typeof roleIcons] || Eye;
            return (
              <Card key={m.id}>
                <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-primary">
                      {(m.profiles?.display_name || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{m.profiles?.display_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
                    <RoleIcon className="h-3 w-3" />
                    {m.role}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
