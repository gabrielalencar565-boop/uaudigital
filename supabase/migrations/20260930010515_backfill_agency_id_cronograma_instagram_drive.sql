update public.publication_calendars set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.calendar_publications set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.instagram_connections set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.instagram_oauth_states set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.drive_client_folders set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.drive_folder_cache set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
