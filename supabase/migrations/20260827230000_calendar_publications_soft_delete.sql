-- pm_task_soft_delete_cleanup_calendar previously HARD-DELETED a calendar_publications row
-- the instant its linked pm_tasks row got deleted_at set — permanently destroying the
-- schedule/caption with zero recovery path (no soft-delete, no audit log, no backup on this
-- project's plan). This is what erased already-filled-in captions for Rio Barra and
-- Atacarejo Goiás when a duplicate PDF-stage container got cleaned up (merged/deleted) —
-- the duplicate-creation bug itself is fixed separately (see the isCompleting guard on the
-- "Concluir" button in PmTaskDetailDialog.tsx), but this makes deletion itself non-destructive
-- going forward: soft-delete instead of hard-delete, and restore it if the task is restored.
alter table public.calendar_publications add column if not exists deleted_at timestamptz;

create or replace function public.pm_task_soft_delete_cleanup_calendar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.calendar_publications set deleted_at = now() where task_id = new.id and deleted_at is null;
  elsif new.deleted_at is null and old.deleted_at is not null then
    update public.calendar_publications set deleted_at = null where task_id = new.id and deleted_at is not null;
  end if;
  return new;
end;
$function$;

drop trigger if exists pm_task_soft_delete_cleanup_calendar_trigger on public.pm_tasks;
create trigger pm_task_soft_delete_cleanup_calendar_trigger
  after update on public.pm_tasks
  for each row
  when (new.deleted_at is distinct from old.deleted_at)
  execute function public.pm_task_soft_delete_cleanup_calendar();
