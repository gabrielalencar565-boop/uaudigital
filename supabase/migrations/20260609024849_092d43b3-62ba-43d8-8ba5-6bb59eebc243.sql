UPDATE public.pm_tasks
SET is_extra_demand = false
WHERE is_extra_demand = true
  AND parent_task_id IS NULL
  AND origin_task_id IS NOT NULL
  AND stage_current IN ('design','edicao_videos','revisao','pdf','agendamento','alteracoes')
  AND deleted_at IS NULL;