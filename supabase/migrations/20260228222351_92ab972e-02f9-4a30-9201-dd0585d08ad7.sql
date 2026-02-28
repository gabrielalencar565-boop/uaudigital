
-- Add missing columns to tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS point_value numeric;

-- Update metas_prazos to numeric
ALTER TABLE public.performance_scores
  ALTER COLUMN metas_prazos TYPE numeric USING metas_prazos::numeric;
