import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Look for error parameters forwarded by Supabase in the URL string
        const errorType = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (errorType || errorDescription) {
          throw new Error(errorDescription || errorType || "Authentication failed");
        }

        // Force a brief check to make sure the session resolves correctly
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (data?.session) {
          // If a redirect path is provided (like /reset-password), use it. Otherwise, head to dashboard
          const nextRoute = searchParams.get("next") || "/dashboard";
          navigate(nextRoute, { replace: true });
        } else {
          // If no session is active yet, wait a moment for the implicit token flow to catch up
          const { data: listenerData } = await supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
              navigate("/dashboard", { replace: true });
            } else if (event === "SIGNED_OUT") {
              navigate("/auth", { replace: true });
            }
          });
        }
      } catch (err: any) {
        console.error("Critical Auth Callback Failure:", err);
        toast({
          title: "Authentication Error",
          description: err.message || "Failed to finalize session.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      <p className="text-sm text-muted-foreground animate-pulse">Processing workspace credentials...</p>
    </div>
  );
}
