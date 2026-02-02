-- Security fix (info): restrict profiles visibility (remove broad authenticated read)
-- Keeps: users can read/update own profile, admins can read all.

DO $$
BEGIN
  -- Drop the overly-broad policy if it exists
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles are readable by authenticated users'
  ) THEN
    EXECUTE 'DROP POLICY "Profiles are readable by authenticated users" ON public.profiles';
  END IF;
END $$;

-- Defensive: ensure expected policies exist (no-op if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can read own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can read all profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;
END $$;