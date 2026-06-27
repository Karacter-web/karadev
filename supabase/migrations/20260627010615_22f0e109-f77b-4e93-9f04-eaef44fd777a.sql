CREATE TABLE public.user_github_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_github_tokens TO authenticated;
GRANT ALL ON public.user_github_tokens TO service_role;

ALTER TABLE public.user_github_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own github token"
  ON public.user_github_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_github_tokens_updated
  BEFORE UPDATE ON public.user_github_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();