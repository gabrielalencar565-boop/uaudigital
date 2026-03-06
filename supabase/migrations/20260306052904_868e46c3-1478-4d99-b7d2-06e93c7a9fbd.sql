
ALTER TABLE public.pm_stage_flows ADD COLUMN IF NOT EXISTS transition_dates jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.pm_tasks ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
