-- Propagate parent assignee (Ana Beatriz) to all subtasks of "Vidas - Agendamento - Abril"
UPDATE pm_tasks
SET assignee_id = 'd4e34607-c14f-4d71-949a-ac8923636fb1',
    updated_at = now()
WHERE parent_task_id = '62a0400a-3dd5-4dd3-a256-5e87acc4fee1'
  AND deleted_at IS NULL;

-- Recompute deadline points for Bruna Felix (old) and Ana Beatriz (new) for April 2026
SELECT public.recompute_metas_prazos('afb3735f-41ee-46bf-8b44-52ef6c2d2fbd', 2026, 4);
SELECT public.recompute_metas_prazos('d4e34607-c14f-4d71-949a-ac8923636fb1', 2026, 4);