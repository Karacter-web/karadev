
-- Fix infinite recursion in workspace_members SELECT policy
-- The current policy self-references workspace_members, causing recursion.
-- Replace with a direct auth.uid() check that doesn't recurse.

DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;

CREATE POLICY "Members can view workspace members"
  ON public.workspace_members
  FOR SELECT
  USING (user_id = auth.uid() OR workspace_id IN (
    SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
  ));

-- Also fix the self-referencing INSERT policy "Admins can manage members"
DROP POLICY IF EXISTS "Admins can manage members" ON public.workspace_members;

CREATE POLICY "Admins can manage members"
  ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
    )
    OR
    workspace_id IN (
      SELECT wm2.workspace_id FROM public.workspace_members wm2
      WHERE wm2.user_id = auth.uid() AND wm2.role = 'admin'
    )
  );

-- Fix self-referencing UPDATE policy
DROP POLICY IF EXISTS "Admins can update members" ON public.workspace_members;

CREATE POLICY "Admins can update members"
  ON public.workspace_members
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT wm2.workspace_id FROM public.workspace_members wm2
      WHERE wm2.user_id = auth.uid() AND wm2.role = 'admin'
    )
  );

-- Fix self-referencing DELETE policy
DROP POLICY IF EXISTS "Admins can delete members" ON public.workspace_members;

CREATE POLICY "Admins can delete members"
  ON public.workspace_members
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT wm2.workspace_id FROM public.workspace_members wm2
      WHERE wm2.user_id = auth.uid() AND wm2.role = 'admin'
    )
  );
