
CREATE TABLE public.audit_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target text NOT NULL DEFAULT 'full',
  trigger_method text NOT NULL DEFAULT 'dashboard',
  status text NOT NULL DEFAULT 'running',
  issues_count integer NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  report jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_scans TO authenticated;
GRANT ALL ON public.audit_scans TO service_role;
ALTER TABLE public.audit_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit scans" ON public.audit_scans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete audit scans" ON public.audit_scans FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_audit_scans_created ON public.audit_scans(created_at DESC);
CREATE INDEX idx_audit_scans_admin ON public.audit_scans(admin_user_id, created_at DESC);

CREATE TABLE public.audit_settings (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  rate_limit_per_24h integer NOT NULL DEFAULT 2,
  alert_threshold_critical integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT audit_settings_singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.audit_settings TO authenticated;
GRANT ALL ON public.audit_settings TO service_role;
ALTER TABLE public.audit_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit settings" ON public.audit_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update audit settings" ON public.audit_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert audit settings" ON public.audit_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.audit_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
