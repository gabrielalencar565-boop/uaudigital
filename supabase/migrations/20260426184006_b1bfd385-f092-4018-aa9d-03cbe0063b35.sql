
-- Doce Rio: soft delete duplicata vazia
UPDATE public.pm_tasks SET deleted_at = now(), updated_at = now()
WHERE id = 'a15c094c-7d7f-4547-bf96-7e305a551cfb' AND deleted_at IS NULL;

-- Laylla: soft delete duplicata vazia
UPDATE public.pm_tasks SET deleted_at = now(), updated_at = now()
WHERE id = 'bcb4c515-5c83-47d7-99b5-5f7f5bcaf24b' AND deleted_at IS NULL;

-- Mariana: soft delete duplicata vazia
UPDATE public.pm_tasks SET deleted_at = now(), updated_at = now()
WHERE id = '95df466c-5794-4361-b801-a7b8f586f8de' AND deleted_at IS NULL;

-- Dra. Tayse: mover children do PDF extra (6c13...) para o mestre (c9c2...)
UPDATE public.pm_tasks
SET parent_task_id = 'c9c25396-9af8-45ab-bdcf-dae51ee38dbe', updated_at = now()
WHERE parent_task_id = '6c135173-7a7c-4bb8-a269-83d032eb279d' AND deleted_at IS NULL;

UPDATE public.pm_tasks SET deleted_at = now(), updated_at = now()
WHERE id = '6c135173-7a7c-4bb8-a269-83d032eb279d' AND deleted_at IS NULL;

-- Instituto Trid: mover children do PDF extra (998b...) para o mestre (e3d8...)
UPDATE public.pm_tasks
SET parent_task_id = 'e3d819f3-1dfc-414c-b51c-bef58b8da375', updated_at = now()
WHERE parent_task_id = '998b9897-9e4d-41e8-8982-c13c5008751d' AND deleted_at IS NULL;

UPDATE public.pm_tasks SET deleted_at = now(), updated_at = now()
WHERE id = '998b9897-9e4d-41e8-8982-c13c5008751d' AND deleted_at IS NULL;

-- Garantir post_type NULL nos PDFs principais não-extras (unificados)
UPDATE public.pm_tasks
SET post_type = NULL, updated_at = now()
WHERE stage_current = 'pdf'
  AND parent_task_id IS NULL
  AND deleted_at IS NULL
  AND is_extra_demand = false
  AND post_type IS NOT NULL;
