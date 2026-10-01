update public.tasks set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.client_stages set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.client_cycles set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.client_cycle_stages set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.performance_scores set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;

alter table public.task_deadline_overrides disable trigger task_deadline_overrides_sync_metas_trigger;
update public.task_deadline_overrides set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
alter table public.task_deadline_overrides enable trigger task_deadline_overrides_sync_metas_trigger;

update public.task_assignees set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.task_activity_log set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
