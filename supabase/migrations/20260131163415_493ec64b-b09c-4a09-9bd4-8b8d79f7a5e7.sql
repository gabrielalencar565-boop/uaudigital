-- ============================================================
-- Phase 1: Add due_at column to tasks for precise time scheduling
-- ============================================================
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS due_at timestamptz NULL;

COMMENT ON COLUMN public.tasks.due_at IS 
  'Data/hora precisa da tarefa. Se NULL, usa due_date como dia inteiro.';

-- ============================================================
-- Phase 2: Create task_assignees table for multiple assignees
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone authenticated can read task assignees
CREATE POLICY "task_assignees_select_authenticated"
  ON public.task_assignees FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS: Admin can manage all task assignees
CREATE POLICY "task_assignees_admin_all"
  ON public.task_assignees FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS: Assignee can remove themselves
CREATE POLICY "task_assignees_self_delete"
  ON public.task_assignees FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for task_assignees
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;