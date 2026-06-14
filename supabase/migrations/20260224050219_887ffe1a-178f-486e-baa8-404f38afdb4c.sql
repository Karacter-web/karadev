
-- Add workspace_id to conversations and make repository_id optional
ALTER TABLE public.conversations ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);

-- Backfill workspace_id from repository for existing rows
UPDATE public.conversations c
SET workspace_id = r.workspace_id
FROM public.repositories r
WHERE c.repository_id = r.id;

-- Make workspace_id NOT NULL after backfill
ALTER TABLE public.conversations ALTER COLUMN workspace_id SET NOT NULL;

-- Make repository_id nullable
ALTER TABLE public.conversations ALTER COLUMN repository_id DROP NOT NULL;

-- Drop old RLS policies that use repository join
DROP POLICY IF EXISTS "Members can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Owner can delete conversation" ON public.conversations;

-- New RLS policies using workspace_id directly
CREATE POLICY "Members can view conversations"
ON public.conversations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = conversations.workspace_id
  AND wm.user_id = auth.uid()
));

CREATE POLICY "Members can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = conversations.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Owner can delete conversation"
ON public.conversations FOR DELETE
USING (user_id = auth.uid());

-- Add update policy for renaming conversations
CREATE POLICY "Owner can update conversation"
ON public.conversations FOR UPDATE
USING (user_id = auth.uid());
