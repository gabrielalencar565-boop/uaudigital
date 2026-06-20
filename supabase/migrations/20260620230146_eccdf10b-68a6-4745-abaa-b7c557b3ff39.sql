-- Ensure Data API has access to task_appeals
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_appeals TO authenticated;
GRANT ALL ON public.task_appeals TO service_role;

-- Unique appeal per (task,user) to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS task_appeals_task_user_uniq ON public.task_appeals (task_id, user_id);

-- Helpful index for admin lookups
CREATE INDEX IF NOT EXISTS task_appeals_status_idx ON public.task_appeals (status);
