
-- ==========================================
-- FIX CRITICAL RLS BUGS: self-referencing joins
-- (wm.workspace_id = wm.workspace_id) always TRUE
-- ==========================================

-- ===== REPOSITORIES =====
DROP POLICY IF EXISTS "Members can view repos" ON public.repositories;
CREATE POLICY "Members can view repos" ON public.repositories FOR SELECT
USING (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = repositories.workspace_id AND wm.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Admins/devs can add repos" ON public.repositories;
CREATE POLICY "Admins/devs can add repos" ON public.repositories FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = repositories.workspace_id AND wm.user_id = auth.uid()
    AND wm.role IN ('admin', 'developer')
));

DROP POLICY IF EXISTS "Admins can delete repos" ON public.repositories;
CREATE POLICY "Admins can delete repos" ON public.repositories FOR DELETE
USING (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = repositories.workspace_id AND wm.user_id = auth.uid()
    AND wm.role = 'admin'
));

-- ===== WORKSPACE_MEMBERS =====
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members" ON public.workspace_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Admins can manage members" ON public.workspace_members;
CREATE POLICY "Admins can manage members" ON public.workspace_members FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid()
    AND wm.role = 'admin'
));

DROP POLICY IF EXISTS "Admins can update members" ON public.workspace_members;
CREATE POLICY "Admins can update members" ON public.workspace_members FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid()
    AND wm.role = 'admin'
));

DROP POLICY IF EXISTS "Admins can delete members" ON public.workspace_members;
CREATE POLICY "Admins can delete members" ON public.workspace_members FOR DELETE
USING (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid()
    AND wm.role = 'admin'
));

-- ===== WORKSPACES =====
DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
CREATE POLICY "Members can view workspaces" ON public.workspaces FOR SELECT
USING (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = workspaces.id AND wm.user_id = auth.uid()
));

-- ===== PROMPT_TEMPLATES =====
DROP POLICY IF EXISTS "Members can view templates" ON public.prompt_templates;
CREATE POLICY "Members can view templates" ON public.prompt_templates FOR SELECT
USING (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = prompt_templates.workspace_id AND wm.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Members can create templates" ON public.prompt_templates;
CREATE POLICY "Members can create templates" ON public.prompt_templates FOR INSERT
WITH CHECK (created_by = auth.uid() AND EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = prompt_templates.workspace_id AND wm.user_id = auth.uid()
));

-- ===== TASKS =====
DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;
CREATE POLICY "Members can view tasks" ON public.tasks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Members can create tasks" ON public.tasks;
CREATE POLICY "Members can create tasks" ON public.tasks FOR INSERT
WITH CHECK (created_by = auth.uid() AND EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Members can update tasks" ON public.tasks;
CREATE POLICY "Members can update tasks" ON public.tasks FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
));

-- ===== MESSAGES =====
-- Fix: conversations can have null repository_id, so join through workspace directly
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages" ON public.messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM conversations c
  JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
  WHERE c.id = messages.conversation_id AND wm.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Members can insert messages" ON public.messages;
CREATE POLICY "Members can insert messages" ON public.messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM conversations c
  JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
  WHERE c.id = messages.conversation_id AND wm.user_id = auth.uid()
));
