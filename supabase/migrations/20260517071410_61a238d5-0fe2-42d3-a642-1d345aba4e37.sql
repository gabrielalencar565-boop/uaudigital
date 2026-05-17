CREATE POLICY "Authenticated users can view task deadline overrides"
ON public.task_deadline_overrides
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);