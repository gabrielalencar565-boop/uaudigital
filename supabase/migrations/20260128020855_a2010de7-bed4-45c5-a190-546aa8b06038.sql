-- Bootstrap admin safely without recursion

-- 1) Helper to check if any admin exists
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  )
$$;

-- 2) Allow the first authenticated user to self-assign admin ONCE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Bootstrap first admin'
  ) THEN
    EXECUTE 'CREATE POLICY "Bootstrap first admin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (role = ''admin'' AND user_id = auth.uid() AND public.admin_exists() = false)';
  END IF;
END $$;
