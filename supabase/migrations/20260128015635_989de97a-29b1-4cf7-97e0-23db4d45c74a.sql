-- Allow users to read their own role rows (needed for client-side permission gating)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users can read their own roles') THEN
    EXECUTE 'CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;
END $$;