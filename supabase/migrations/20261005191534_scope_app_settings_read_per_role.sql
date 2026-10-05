-- anon has no EXECUTE on current_agency_id(), so a single policy that mentions it errors for signed-out visitors.
drop policy "app_settings_select_default_or_own_agency" on public.app_settings;
create policy "app_settings_select_anon_default" on public.app_settings
  for select to anon using (id = 1);
create policy "app_settings_select_auth_default_or_own" on public.app_settings
  for select to authenticated using (id = 1 or agency_id = (select public.current_agency_id()));
