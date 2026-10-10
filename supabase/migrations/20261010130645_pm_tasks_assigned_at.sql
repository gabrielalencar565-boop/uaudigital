-- When a task became someone's: lets the bell show "Tarefa atribuída a você" for a couple of days, like the push does.
alter table public.pm_tasks add column assigned_at timestamptz;

create or replace function public.pm_tasks_set_assigned_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or old.assignee_id is distinct from new.assignee_id) then
    new.assigned_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_pm_tasks_set_assigned_at
before insert or update of assignee_id on public.pm_tasks
for each row execute function public.pm_tasks_set_assigned_at();
