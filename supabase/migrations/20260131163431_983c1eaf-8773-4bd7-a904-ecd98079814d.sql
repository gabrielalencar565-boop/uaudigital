-- ============================================================
-- Phase 3: Add RLS policies for planner role on tasks
-- ============================================================

-- Planner can create tasks
CREATE POLICY "Planner can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'planner'::public.app_role) 
    AND created_by = auth.uid()
  );

-- Planner can update tasks
CREATE POLICY "Planner can update tasks"
  ON public.tasks FOR UPDATE
  USING (public.has_role(auth.uid(), 'planner'::public.app_role));

-- Planner can manage task assignees
CREATE POLICY "task_assignees_planner_all"
  ON public.task_assignees FOR ALL
  USING (public.has_role(auth.uid(), 'planner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'planner'::public.app_role));