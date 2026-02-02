-- Public-ish team directory for rankings (separate from private profiles)
CREATE TABLE IF NOT EXISTS public.team_members (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL,
  role_title text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can see the team for rankings
DROP POLICY IF EXISTS "Team members readable by authenticated" ON public.team_members;
CREATE POLICY "Team members readable by authenticated"
ON public.team_members
FOR SELECT
TO authenticated
USING (true);

-- Users can create their own record; admins can create for anyone
DROP POLICY IF EXISTS "Users can insert own team member" ON public.team_members;
CREATE POLICY "Users can insert own team member"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Users can update their own record; admins can update anyone
DROP POLICY IF EXISTS "Users can update own team member" ON public.team_members;
CREATE POLICY "Users can update own team member"
ON public.team_members
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- optional: keep data tidy
CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_team_members_role_title ON public.team_members (role_title);
