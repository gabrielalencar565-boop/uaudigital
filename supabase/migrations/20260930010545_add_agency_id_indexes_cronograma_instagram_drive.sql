create index if not exists publication_calendars_agency_id_idx on public.publication_calendars (agency_id);
create index if not exists calendar_publications_agency_id_idx on public.calendar_publications (agency_id);
create index if not exists instagram_connections_agency_id_idx on public.instagram_connections (agency_id);
create index if not exists instagram_oauth_states_agency_id_idx on public.instagram_oauth_states (agency_id);
create index if not exists drive_client_folders_agency_id_idx on public.drive_client_folders (agency_id);
create index if not exists drive_folder_cache_agency_id_idx on public.drive_folder_cache (agency_id);
