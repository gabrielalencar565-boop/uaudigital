alter table public.publication_calendars add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.calendar_publications add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.instagram_connections add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.instagram_oauth_states add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.drive_client_folders add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.drive_folder_cache add column agency_id uuid references public.agencies(id) default public.current_agency_id();
