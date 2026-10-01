alter table public.pm_projects add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.pm_subtasks add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.pm_comments add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.pm_attachments add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.pm_activity_log add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.pm_stage_flows add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.pm_cronograma_feedback add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.pm_tags add column agency_id uuid references public.agencies(id) default public.current_agency_id();
