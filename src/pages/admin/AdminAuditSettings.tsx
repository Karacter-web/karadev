import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings2, Loader2, Trash2 } from "lucide-react";

export default function AdminAuditSettings() {
  const [enabled, setEnabled] = useState(true);
  const [limit, setLimit] = useState(2);
  const [threshold, setThreshold] = useState(5);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("audit_settings").select("*").eq("id", 1).maybeSingle();
    if (data) { setEnabled(data.enabled); setLimit(data.rate_limit_per_24h); setThreshold(data.alert_threshold_critical); }
    setLoading(false);
  })(); }, []);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("audit_settings").upsert({
      id: 1, enabled, rate_limit_per_24h: limit, alert_threshold_critical: threshold, updated_by: user?.id, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  }

  async function clearHistory() {
    if (!confirm("Delete ALL audit scan reports? This cannot be undone.")) return;
    const { error } = await supabase.from("audit_scans").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) toast.error(error.message); else toast.success("History cleared");
  }

  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Settings2 className="h-7 w-7" /> Audit Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage the platform-wide audit scan feature.</p>
      </div>

      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Enable Audit Scans</Label>
            <p className="text-xs text-muted-foreground">Disable to block all SCAN requests platform-wide.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="space-y-2">
          <Label>Scans per 24 hours (per admin)</Label>
          <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 1)} />
          <p className="text-xs text-muted-foreground">Default: 2. Power users can be raised to 5+.</p>
        </div>
        <div className="space-y-2">
          <Label>Critical-issue alert threshold</Label>
          <Input type="number" min={1} max={1000} value={threshold} onChange={(e) => setThreshold(Number(e.target.value) || 1)} />
          <p className="text-xs text-muted-foreground">Number of critical issues that should trigger alerts (notifier hookup pending).</p>
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="destructive" size="sm" onClick={clearHistory}>
            <Trash2 className="h-4 w-4 mr-2" /> Clear all reports
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save settings
          </Button>
        </div>
      </Card>

      <Card className="p-5 bg-muted/30">
        <div className="text-sm font-medium mb-2">CLI usage</div>
        <pre className="text-xs font-mono whitespace-pre-wrap bg-background p-3 rounded">
{`# Run a full scan via curl (uses your admin Supabase access token):
curl -X POST "$SUPABASE_URL/functions/v1/audit-scan" \\
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"target":"full","trigger_method":"cli"}'`}
        </pre>
      </Card>
    </div>
  );
}