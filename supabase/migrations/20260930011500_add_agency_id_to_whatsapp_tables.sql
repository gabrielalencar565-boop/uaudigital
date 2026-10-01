alter table public.whatsapp_contacts add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.whatsapp_messages add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.whatsapp_outbox add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.whatsapp_send_log add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.whatsapp_automations add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.whatsapp_ranking_state add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.user_whatsapp_preferences add column agency_id uuid references public.agencies(id) default public.current_agency_id();
