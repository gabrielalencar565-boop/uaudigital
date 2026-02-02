-- Tighten access to clients data: ensure only authenticated users can read

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = 'Clients readable by authenticated'
  ) THEN
    EXECUTE 'DROP POLICY "Clients readable by authenticated" ON public.clients';
  END IF;
END$$;

CREATE POLICY "Clients readable by authenticated"
ON public.clients
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
