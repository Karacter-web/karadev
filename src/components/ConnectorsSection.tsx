import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plug, RefreshCw, Trash2, Check, AlertTriangle, ExternalLink, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PROVIDERS, type ProviderConfig, type ProviderName } from "@/lib/connectors/providers";
import { ADAPTERS } from "@/lib/connectors/adapters";

type ConnectorRow = {
  id: string;
  provider: string;
  credentials: Record<string, string>;
  capabilities: string[];
  status: string;
  last_error: string | null;
  last_checked_at: string | null;
};

const statusStyles: Record<string, string> = {
  connected: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default function ConnectorsSection({ userId }: { userId: string }) {
  const [rows, setRows] = useState<ConnectorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<ProviderName | null>(null);
  const [draftToken, setDraftToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("user_connectors")
      .select("*")
      .eq("user_id", userId);
    if (error) toast({ title: "Failed to load connectors", description: error.message, variant: "destructive" });
    setRows((data as ConnectorRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (userId) load(); /* eslint-disable-next-line */ }, [userId]);

  const rowFor = (p: ProviderName) => rows.find((r) => r.provider === p);

  const connect = async (provider: ProviderConfig) => {
    if (!draftToken.trim()) {
      toast({ title: "Token required", variant: "destructive" });
      return;
    }
    setBusy(provider.name);
    const creds = { token: draftToken.trim() };
    const result = await ADAPTERS[provider.name].validate(creds);
    const payload = {
      user_id: userId,
      provider: provider.name,
      credentials: creds,
      capabilities: result.capabilities,
      status: result.valid ? "connected" : "error",
      last_error: result.valid ? null : result.error || "Unknown error",
      last_checked_at: new Date().toISOString(),
    };
    const { error } = await (supabase as any)
      .from("user_connectors")
      .upsert(payload, { onConflict: "user_id,provider" });
    setBusy(null);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: result.valid ? `Connected to ${provider.label}` : `${provider.label} validation failed`,
      description: result.valid ? "Credentials validated and stored." : result.error,
      variant: result.valid ? "default" : "destructive",
    });
    setDraftToken("");
    setShowToken(false);
    setExpanded(null);
    await load();
  };

  const recheck = async (row: ConnectorRow) => {
    setBusy(row.provider);
    const result = await ADAPTERS[row.provider as ProviderName].healthCheck(row.credentials);
    await (supabase as any)
      .from("user_connectors")
      .update({
        status: result.healthy ? "connected" : "error",
        last_error: result.healthy ? null : result.error || null,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setBusy(null);
    toast({
      title: result.healthy ? "Healthy" : "Unhealthy",
      description: result.error || result.warning || "Connector is reachable.",
      variant: result.healthy ? "default" : "destructive",
    });
    await load();
  };

  const disconnect = async (row: ConnectorRow) => {
    setBusy(row.provider);
    const { error } = await (supabase as any).from("user_connectors").delete().eq("id", row.id);
    setBusy(null);
    if (error) {
      toast({ title: "Failed to disconnect", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Disconnected" });
    await load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Connectors</CardTitle>
            <CardDescription>
          Connect external services (GitHub, Supabase, Vercel, Netlify, Google Cloud) with personal
              tokens. Each connector is validated against the live provider API and health-checked on demand.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-xs text-muted-foreground">Loading connectors…</p>}
        {PROVIDERS.map((p) => {
          const row = rowFor(p.name);
          const isOpen = expanded === p.name;
          const Icon = p.icon;
          return (
            <div key={p.name} className="rounded-lg border border-border bg-card/50">
              <div className="flex items-center gap-3 p-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{p.label}</p>
                    {row && (
                      <Badge variant="outline" className={statusStyles[row.status] || statusStyles.pending}>
                        {row.status === "connected" ? (
                          <><Check className="h-3 w-3 mr-1" /> Connected</>
                        ) : row.status === "error" ? (
                          <><AlertTriangle className="h-3 w-3 mr-1" /> Error</>
                        ) : (
                          row.status
                        )}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                  {row?.last_error && <p className="text-[11px] text-destructive mt-1">{row.last_error}</p>}
                </div>
                {row ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" disabled={busy === p.name} onClick={() => recheck(row)} title="Re-check health">
                      <RefreshCw className={`h-3.5 w-3.5 ${busy === p.name ? "animate-spin" : ""}`} />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === p.name} onClick={() => disconnect(row)} title="Disconnect">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { setExpanded(isOpen ? null : p.name); setDraftToken(""); }}>
                    {isOpen ? "Cancel" : "Connect"}
                  </Button>
                )}
              </div>
              {isOpen && !row && (
                <div className="border-t border-border p-3 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">{p.fields[0].label}</Label>
                    <div className="relative">
                      <Input
                        type={showToken ? "text" : "password"}
                        placeholder={p.fields[0].placeholder}
                        value={draftToken}
                        onChange={(e) => setDraftToken(e.target.value)}
                        className="pr-10 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                      >
                        {showToken ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {p.helpUrl ? (
                      <a href={p.helpUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline">
                        Where to get a token <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : <span />}
                    <Button size="sm" disabled={busy === p.name || !draftToken.trim()} onClick={() => connect(p)}>
                      {busy === p.name ? "Validating…" : "Validate & Save"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.capabilities.map((cap) => (
                      <Badge key={cap} variant="outline" className="text-[10px] font-mono">{cap}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <p className="text-[11px] text-muted-foreground italic pt-2 border-t border-border">
          Tokens are stored in Supabase and scoped to your user via row-level security. For production secrets,
          use a server-side secret vault and encrypt at-rest with a server-only key.
        </p>
      </CardContent>
    </Card>
  );
}