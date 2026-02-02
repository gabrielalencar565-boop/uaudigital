-- Allow all authenticated users to read all team members (for global day view)
-- Replace existing restrictive select policies.
DROP POLICY IF EXISTS "Admins can read all team members" ON public.team_members;
DROP POLICY IF EXISTS "Team members readable by self" ON public.team_members;

CREATE POLICY "Team members readable by authenticated"
ON public.team_members
FOR SELECT
TO authenticated
USING (true);
