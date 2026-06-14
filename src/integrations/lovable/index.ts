import { supabase } from "../supabase/client";

type Provider = "google" | "apple";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: Provider, opts?: SignInOptions) => {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider,
          options: {
            // Supabase expects redirectTo instead of redirect_uri
            redirectTo: opts?.redirect_uri || window.location.origin,
            queryParams: opts?.extraParams,
          },
        });

        if (error) throw error;

        // Return a shape consistent with what your UI expects
        return {
          redirected: !!data.url,
          error: null,
          url: data.url,
        };
      } catch (e) {
        return {
          redirected: false,
          error: e instanceof Error ? e : new Error(String(e)),
        };
      }
    },
  },
};
