
-- Add origin_task_id to track task lineage across stage advances
ALTER TABLE public.pm_tasks
ADD COLUMN origin_task_id uuid REFERENCES public.pm_tasks(id) ON DELETE SET NULL DEFAULT NULL;

-- Index for fast lookup of downstream tasks
CREATE INDEX idx_pm_tasks_origin_task_id ON public.pm_tasks(origin_task_id) WHERE origin_task_id IS NOT NULL;
