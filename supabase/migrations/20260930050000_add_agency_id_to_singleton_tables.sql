alter table public.app_settings add column agency_id uuid references public.agencies(id);
alter table public.xp_settings add column agency_id uuid references public.agencies(id);
alter table public.pm_pdf_settings add column agency_id uuid references public.agencies(id);
alter table public.whatsapp_settings add column agency_id uuid references public.agencies(id);
alter table public.drive_oauth_token_cache add column agency_id uuid references public.agencies(id);

alter table public.xp_settings drop constraint xp_settings_id_check;
alter table public.whatsapp_settings drop constraint whatsapp_settings_id_check;
alter table public.drive_oauth_token_cache drop constraint drive_oauth_token_cache_singleton;
