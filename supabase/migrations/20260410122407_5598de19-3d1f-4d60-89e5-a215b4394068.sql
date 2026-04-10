ALTER TABLE public.task_deadline_overrides
  ALTER COLUMN override_points TYPE numeric USING override_points::numeric;