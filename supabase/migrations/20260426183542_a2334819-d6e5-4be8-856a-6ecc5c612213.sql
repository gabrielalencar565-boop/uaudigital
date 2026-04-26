
-- Unificar PDFs duplicados de Mariana (Abril): mover children do PDF menor (95df...) para o mestre (eeeb...)
UPDATE public.pm_tasks
SET parent_task_id = 'eeeb4984-0ce9-4ea0-a26a-3a315b8e8fa2',
    updated_at = now()
WHERE parent_task_id = '95df466c-5794-4361-b801-a7b8f586f8de'
  AND deleted_at IS NULL;

-- Soft-delete do PDF duplicado vazio
UPDATE public.pm_tasks
SET deleted_at = now(),
    updated_at = now()
WHERE id = '95df466c-5794-4361-b801-a7b8f586f8de'
  AND deleted_at IS NULL;

-- Garantir que todos os PDFs parent ativos não-extra fiquem com post_type NULL (unificados)
UPDATE public.pm_tasks
SET post_type = NULL,
    updated_at = now()
WHERE stage_current = 'pdf'
  AND parent_task_id IS NULL
  AND deleted_at IS NULL
  AND is_extra_demand = false
  AND post_type IS NOT NULL;
