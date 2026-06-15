
-- 1. Enum for AI source
DO $$ BEGIN
  CREATE TYPE public.ai_agent_source AS ENUM ('web','vscode','embed','api');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. ai_audit_logs
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  source public.ai_agent_source NOT NULL DEFAULT 'web',
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  latency_ms integer,
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_audit_logs TO authenticated;
GRANT ALL ON public.ai_audit_logs TO service_role;

ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view audit logs for their workspaces"
  ON public.ai_audit_logs FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL AND user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id))
  );

CREATE INDEX IF NOT EXISTS ai_audit_logs_workspace_idx ON public.ai_audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_audit_logs_user_idx ON public.ai_audit_logs(user_id, created_at DESC);

-- 3. api_keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['chat']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view their workspace api keys"
  ON public.api_keys FOR SELECT TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins create api keys for their workspaces"
  ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "Admins revoke their workspace api keys"
  ON public.api_keys FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins delete their workspace api keys"
  ON public.api_keys FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE INDEX IF NOT EXISTS api_keys_workspace_idx ON public.api_keys(workspace_id);

-- 4. prompt_templates.category
ALTER TABLE public.prompt_templates ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS prompt_templates_category_idx ON public.prompt_templates(workspace_id, category);

-- 5. workspaces.slug
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS slug text;
UPDATE public.workspaces
  SET slug = COALESCE(slug, regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '-' || substr(id::text, 1, 6))
  WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_unique ON public.workspaces(slug);

-- 6. daily_usage missing grants
GRANT SELECT ON public.daily_usage TO authenticated;
GRANT ALL ON public.daily_usage TO service_role;

-- 7. Realtime for messages
ALTER TABLE public.messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN others THEN NULL; END $$;
