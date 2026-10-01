create index if not exists pm_projects_agency_id_idx on public.pm_projects (agency_id);
create index if not exists pm_subtasks_agency_id_idx on public.pm_subtasks (agency_id);
create index if not exists pm_comments_agency_id_idx on public.pm_comments (agency_id);
create index if not exists pm_attachments_agency_id_idx on public.pm_attachments (agency_id);
create index if not exists pm_activity_log_agency_id_idx on public.pm_activity_log (agency_id);
create index if not exists pm_stage_flows_agency_id_idx on public.pm_stage_flows (agency_id);
create index if not exists pm_cronograma_feedback_agency_id_idx on public.pm_cronograma_feedback (agency_id);
create index if not exists pm_tags_agency_id_idx on public.pm_tags (agency_id);
