alter table public.crm_leads add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.crm_tasks add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.crm_proposals add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.crm_activity_log add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.crm_lead_automations add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.crm_lead_welcome_log add column agency_id uuid references public.agencies(id) default public.current_agency_id();
