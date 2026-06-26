
CREATE TABLE public.sandbox_snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  language TEXT NOT NULL DEFAULT 'python',
  code TEXT NOT NULL DEFAULT '',
  last_output TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sandbox_snippets TO authenticated;
GRANT ALL ON public.sandbox_snippets TO service_role;

ALTER TABLE public.sandbox_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage their own snippets"
ON public.sandbox_snippets FOR ALL
TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_sandbox_snippets_updated_at
BEFORE UPDATE ON public.sandbox_snippets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
