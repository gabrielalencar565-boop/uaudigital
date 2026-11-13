-- A busca de todas as subtarefas (parent_task_id não nulo, ordenada por created_at) fazia varredura da tabela inteira;
-- com a equipe toda aberta isso sobrecarregava o banco. Índice parcial para essa busca.
create index if not exists idx_pm_tasks_children_created on public.pm_tasks (created_at) where parent_task_id is not null and deleted_at is null;
analyze public.pm_tasks;
