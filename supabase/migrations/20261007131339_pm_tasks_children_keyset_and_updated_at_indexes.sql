-- usePmAllChildTasks reads every subtask ordered by created_at: with OFFSET pagination and no matching index Postgres
-- re-sorted ~9k rows on disk for every 1000-row page (~180 ms each). This index serves the ordered/keyset scan directly.
create index if not exists idx_pm_tasks_children_created
  on public.pm_tasks (created_at, id)
  where parent_task_id is not null and deleted_at is null;

-- "what changed since" (delta sync of the task lists) filters on updated_at.
create index if not exists idx_pm_tasks_updated_at
  on public.pm_tasks (updated_at);
