
CREATE TABLE public.user_connectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  capabilities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_connectors TO authenticated;
GRANT ALL ON public.user_connectors TO service_role;

ALTER TABLE public.user_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own connectors"
  ON public.user_connectors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_connectors_updated_at
  BEFORE UPDATE ON public.user_connectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX user_connectors_user_id_idx ON public.user_connectors(user_id);
