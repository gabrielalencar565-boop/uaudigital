-- Security hardening: make tasks SELECT explicitly require authentication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tasks'
      AND policyname = 'Tasks readable by authenticated'
  ) THEN
    EXECUTE 'DROP POLICY "Tasks readable by authenticated" ON public.tasks';
  END IF;
END$$;

CREATE POLICY "Tasks readable by authenticated"
ON public.tasks
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
