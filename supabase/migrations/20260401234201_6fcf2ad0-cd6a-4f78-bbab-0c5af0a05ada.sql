
ALTER TABLE public.pm_tasks
  ADD COLUMN deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN deleted_by uuid DEFAULT NULL;

CREATE INDEX idx_pm_tasks_deleted_at ON public.pm_tasks (deleted_at) WHERE deleted_at IS NOT NULL;
