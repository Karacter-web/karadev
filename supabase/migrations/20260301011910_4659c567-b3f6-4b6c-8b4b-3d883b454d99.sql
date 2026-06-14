
-- Step 1: Create security definer functions that bypass RLS
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id
$$;

-- Step 2: Drop ALL existing workspace_members policies
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owner can add self as member" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can update members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can delete members" ON public.workspace_members;

-- Step 3: Recreate policies using security definer functions (NO self-reference)
CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  );

CREATE POLICY "Owner can add self as member"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid())
  );

CREATE POLICY "Admins can manage members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid())
    OR public.is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE POLICY "Admins can update members"
  ON public.workspace_members FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can delete members"
  ON public.workspace_members FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- Step 4: Fix other tables that join workspace_members (they trigger the recursive SELECT)
-- Replace with security definer function calls

-- workspaces
DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
CREATE POLICY "Members can view workspaces"
  ON public.workspaces FOR SELECT
  USING (id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- conversations
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
CREATE POLICY "Members can view conversations"
  ON public.conversations FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members can create conversations" ON public.conversations;
CREATE POLICY "Members can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));

-- messages
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages"
  ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id AND public.is_workspace_member(auth.uid(), c.workspace_id)
  ));

DROP POLICY IF EXISTS "Members can insert messages" ON public.messages;
CREATE POLICY "Members can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id AND public.is_workspace_member(auth.uid(), c.workspace_id)
  ));

-- repositories
DROP POLICY IF EXISTS "Members can view repos" ON public.repositories;
CREATE POLICY "Members can view repos"
  ON public.repositories FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Admins/devs can add repos" ON public.repositories;
CREATE POLICY "Admins/devs can add repos"
  ON public.repositories FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role IN ('admin', 'developer')
    )
  );

DROP POLICY IF EXISTS "Admins can delete repos" ON public.repositories;
CREATE POLICY "Admins can delete repos"
  ON public.repositories FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- tasks
DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;
CREATE POLICY "Members can view tasks"
  ON public.tasks FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members can create tasks" ON public.tasks;
CREATE POLICY "Members can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (created_by = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members can update tasks" ON public.tasks;
CREATE POLICY "Members can update tasks"
  ON public.tasks FOR UPDATE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- prompt_templates
DROP POLICY IF EXISTS "Members can view templates" ON public.prompt_templates;
CREATE POLICY "Members can view templates"
  ON public.prompt_templates FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members can create templates" ON public.prompt_templates;
CREATE POLICY "Members can create templates"
  ON public.prompt_templates FOR INSERT
  WITH CHECK (created_by = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));
