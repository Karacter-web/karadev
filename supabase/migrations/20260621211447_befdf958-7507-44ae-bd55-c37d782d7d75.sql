
-- Trigger function: when admin@karacterhub.xyz signs up, grant admin role
CREATE OR REPLACE FUNCTION public.handle_admin_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'admin@karacterhub.xyz' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_admin_promote ON auth.users;
CREATE TRIGGER on_auth_user_created_admin_promote
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_admin_promotion();

-- Backfill: if admin user already exists, ensure role is granted
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'admin@karacterhub.xyz'
ON CONFLICT (user_id, role) DO NOTHING;
