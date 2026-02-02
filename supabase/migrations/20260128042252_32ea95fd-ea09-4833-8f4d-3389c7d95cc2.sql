-- Tighten RLS for employee data: profiles + performance_scores

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_scores ENABLE ROW LEVEL SECURITY;

-- PROFILES: revoke broad read, allow self + admins
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;

-- Keep/replace with least-privilege policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- PERFORMANCE_SCORES: revoke broad read, allow self + admins
DROP POLICY IF EXISTS "Performance scores readable by authenticated" ON public.performance_scores;
DROP POLICY IF EXISTS "Performance readable by authenticated" ON public.performance_scores;
DROP POLICY IF EXISTS "Performance scores readable by authenticated users" ON public.performance_scores;

-- Ensure the intended policies exist
DROP POLICY IF EXISTS "Users can read own performance" ON public.performance_scores;
DROP POLICY IF EXISTS "Admins can read performance" ON public.performance_scores;

CREATE POLICY "Users can read own performance"
ON public.performance_scores
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can read performance"
ON public.performance_scores
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
