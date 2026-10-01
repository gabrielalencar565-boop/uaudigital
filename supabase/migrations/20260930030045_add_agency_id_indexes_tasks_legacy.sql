create index if not exists tasks_agency_id_idx on public.tasks (agency_id);
create index if not exists client_stages_agency_id_idx on public.client_stages (agency_id);
create index if not exists client_cycles_agency_id_idx on public.client_cycles (agency_id);
create index if not exists client_cycle_stages_agency_id_idx on public.client_cycle_stages (agency_id);
create index if not exists performance_scores_agency_id_idx on public.performance_scores (agency_id);
create index if not exists task_deadline_overrides_agency_id_idx on public.task_deadline_overrides (agency_id);
create index if not exists task_assignees_agency_id_idx on public.task_assignees (agency_id);
create index if not exists task_activity_log_agency_id_idx on public.task_activity_log (agency_id);
