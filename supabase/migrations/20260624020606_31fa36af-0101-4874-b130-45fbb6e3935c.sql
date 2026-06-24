
CREATE TABLE public.generated_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  prompt text NOT NULL,
  source_url text,
  status text NOT NULL DEFAULT 'pending',
  stage text,
  analysis text,
  scaffold_model text,
  analysis_model text,
  files_count integer NOT NULL DEFAULT 0,
  github_repo_url text,
  github_repo_name text,
  error text,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_projects TO authenticated;
GRANT ALL ON public.generated_projects TO service_role;

ALTER TABLE public.generated_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage generated projects"
ON public.generated_projects
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_generated_projects_updated_at
BEFORE UPDATE ON public.generated_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.generated_projects;
