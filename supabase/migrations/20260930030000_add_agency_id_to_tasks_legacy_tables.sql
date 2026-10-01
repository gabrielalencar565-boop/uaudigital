alter table public.tasks add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.client_stages add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.client_cycles add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.client_cycle_stages add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.performance_scores add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.task_deadline_overrides add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.task_assignees add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.task_activity_log add column agency_id uuid references public.agencies(id) default public.current_agency_id();
