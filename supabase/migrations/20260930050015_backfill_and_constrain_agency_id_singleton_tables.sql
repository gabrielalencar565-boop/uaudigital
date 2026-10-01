update public.app_settings set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.xp_settings set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.pm_pdf_settings set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.whatsapp_settings set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.drive_oauth_token_cache set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;

alter table public.app_settings alter column agency_id set not null;
alter table public.xp_settings alter column agency_id set not null;
alter table public.pm_pdf_settings alter column agency_id set not null;
alter table public.whatsapp_settings alter column agency_id set not null;
alter table public.drive_oauth_token_cache alter column agency_id set not null;

alter table public.app_settings add constraint app_settings_agency_id_key unique (agency_id);
alter table public.xp_settings add constraint xp_settings_agency_id_key unique (agency_id);
alter table public.pm_pdf_settings add constraint pm_pdf_settings_agency_id_key unique (agency_id);
alter table public.whatsapp_settings add constraint whatsapp_settings_agency_id_key unique (agency_id);
alter table public.drive_oauth_token_cache add constraint drive_oauth_token_cache_agency_id_key unique (agency_id);
