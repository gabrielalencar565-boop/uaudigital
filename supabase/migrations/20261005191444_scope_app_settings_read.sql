-- The login page needs the default branding (row id = 1) before anyone is signed in; everything else is per agency.
drop policy "App settings are readable by everyone" on public.app_settings;
create policy "app_settings_select_default_or_own_agency" on public.app_settings
  for select to anon, authenticated
  using (id = 1 or agency_id = (select public.current_agency_id()));
