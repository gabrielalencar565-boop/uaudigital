
-- Fix RLS policies: change from RESTRICTIVE to PERMISSIVE

-- cleaning_categories
DROP POLICY IF EXISTS "cleaning_categories_admin_all" ON public.cleaning_categories;
DROP POLICY IF EXISTS "cleaning_categories_select_authenticated" ON public.cleaning_categories;

CREATE POLICY "cleaning_categories_admin_all" ON public.cleaning_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cleaning_categories_select_authenticated" ON public.cleaning_categories
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- cleaning_schedules
DROP POLICY IF EXISTS "cleaning_schedules_admin_all" ON public.cleaning_schedules;
DROP POLICY IF EXISTS "cleaning_schedules_select_authenticated" ON public.cleaning_schedules;

CREATE POLICY "cleaning_schedules_admin_all" ON public.cleaning_schedules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cleaning_schedules_select_authenticated" ON public.cleaning_schedules
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- cleaning_completions
DROP POLICY IF EXISTS "cleaning_completions_admin_all" ON public.cleaning_completions;
DROP POLICY IF EXISTS "cleaning_completions_delete_own" ON public.cleaning_completions;
DROP POLICY IF EXISTS "cleaning_completions_insert_authenticated" ON public.cleaning_completions;
DROP POLICY IF EXISTS "cleaning_completions_select_authenticated" ON public.cleaning_completions;

CREATE POLICY "cleaning_completions_admin_all" ON public.cleaning_completions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cleaning_completions_select_authenticated" ON public.cleaning_completions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "cleaning_completions_insert_authenticated" ON public.cleaning_completions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "cleaning_completions_delete_own" ON public.cleaning_completions
  FOR DELETE TO authenticated
  USING (completed_by = auth.uid());

-- Add due_time column to cleaning_schedules for overdue tracking
ALTER TABLE public.cleaning_schedules ADD COLUMN IF NOT EXISTS due_time time WITHOUT TIME ZONE DEFAULT '18:00:00';
