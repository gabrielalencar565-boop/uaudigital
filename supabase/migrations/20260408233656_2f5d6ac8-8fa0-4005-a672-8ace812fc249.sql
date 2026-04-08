
-- Allow all authenticated users to insert pm_tasks (needed for stage advancement)
CREATE POLICY "pm_tasks_insert_auth"
ON public.pm_tasks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
