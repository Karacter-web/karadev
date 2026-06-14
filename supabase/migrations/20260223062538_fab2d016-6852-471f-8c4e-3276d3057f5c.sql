
-- Auto-create a default workspace for new users via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ws_id uuid;
BEGIN
  -- Create a default workspace for the new user
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace', NEW.id)
  RETURNING id INTO ws_id;

  -- Add user as admin member of their workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws_id, NEW.id, 'admin');

  RETURN NEW;
END;
$$;

-- Trigger fires after handle_new_user (profile creation)
CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_workspace();
