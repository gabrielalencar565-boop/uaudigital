-- Fix security scan errors by tightening SELECT policies

-- PROFILES
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- TEAM_MEMBERS
DROP POLICY IF EXISTS "Team members readable by authenticated" ON public.team_members;

DROP POLICY IF EXISTS "Team members readable by self" ON public.team_members;
CREATE POLICY "Team members readable by self"
ON public.team_members
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all team members" ON public.team_members;
CREATE POLICY "Admins can read all team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
