import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";

const Chat = lazy(() => import("./Chat"));

export default function Embed() {
  const [status, setStatus] = useState<"loading" | "ok" | "invalid">("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("embed-exchange", {
          body: { token },
        });
        if (cancelled) return;
        if (error || !data?.access_token || !data?.refresh_token) {
          setStatus("invalid");
          return;
        }
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        setStatus(sessErr ? "invalid" : "ok");
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (status === "invalid") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Invalid or expired token</h1>
          <p className="text-sm text-muted-foreground">This Karadev embed link is no longer valid. Generate a new API key in your workspace settings.</p>
        </div>
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <div className="min-h-screen bg-background">
        <Chat />
      </div>
    </Suspense>
  );
}