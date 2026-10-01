create index if not exists clients_agency_id_idx on public.clients (agency_id);
create index if not exists pm_tasks_agency_id_idx on public.pm_tasks (agency_id);
create index if not exists team_members_agency_id_idx on public.team_members (agency_id);
create index if not exists cargos_agency_id_idx on public.cargos (agency_id);
create index if not exists feature_permissions_agency_id_idx on public.feature_permissions (agency_id);
create index if not exists scoring_config_agency_id_idx on public.scoring_config (agency_id);
create index if not exists profiles_agency_id_idx on public.profiles (agency_id);
