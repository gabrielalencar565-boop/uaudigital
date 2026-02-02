-- Add active flag to team members so admins can hide removed users from rankings without deleting history
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Helpful index for filtering active members
CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON public.team_members (is_active);

-- Backfill safety (in case older rows could become NULL in some environments)
UPDATE public.team_members SET is_active = true WHERE is_active IS NULL;