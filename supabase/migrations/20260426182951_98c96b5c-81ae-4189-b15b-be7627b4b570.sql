-- Migrar PDFs duplicados (mesmo cliente/mês) em um único PDF unificado
-- Caso 1: Laylla Abril (2× video) → 7dd59ce5 mestre, mover children de bcb4c515
UPDATE public.pm_tasks
SET parent_task_id = '7dd59ce5-3de7-4f10-88e8-a683c6fe98ca'
WHERE parent_task_id = 'bcb4c515-5c83-47d7-99b5-5f7f5bcaf24b';

UPDATE public.pm_tasks
SET deleted_at = now()
WHERE id = 'bcb4c515-5c83-47d7-99b5-5f7f5bcaf24b' AND deleted_at IS NULL;

-- Caso 2: Doce Rio Abril (2× design) → fef6714a mestre (já tem 9 children), mover de a15c094c (0 children)
UPDATE public.pm_tasks
SET deleted_at = now()
WHERE id = 'a15c094c-7d7f-4547-bf96-7e305a551cfb' AND deleted_at IS NULL;

-- Limpar post_type dos PDFs parent ativos não-extra (agora são unificados)
UPDATE public.pm_tasks
SET post_type = NULL
WHERE stage_current = 'pdf'
  AND parent_task_id IS NULL
  AND deleted_at IS NULL
  AND is_extra_demand = false
  AND post_type IS NOT NULL;