-- app_settings (anon SELECT policy left untouched — needs domain-based resolution later)
drop policy "Admins can insert app settings" on public.app_settings;
create policy "Admins can insert app settings" on public.app_settings
  for insert to public
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins can update app settings" on public.app_settings;
create policy "Admins can update app settings" on public.app_settings
  for update to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

-- xp_settings
drop policy "xp_settings_admin_write_delete" on public.xp_settings;
create policy "xp_settings_admin_write_delete" on public.xp_settings
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_settings_admin_write_insert" on public.xp_settings;
create policy "xp_settings_admin_write_insert" on public.xp_settings
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_settings_admin_write_update" on public.xp_settings;
create policy "xp_settings_admin_write_update" on public.xp_settings
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_settings_select_combined" on public.xp_settings;
create policy "xp_settings_select_combined" on public.xp_settings
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- pm_pdf_settings (anon SELECT policy left untouched — needs domain-based resolution later)
drop policy "pm_pdf_settings_admin_all_delete" on public.pm_pdf_settings;
create policy "pm_pdf_settings_admin_all_delete" on public.pm_pdf_settings
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "pm_pdf_settings_admin_all_insert" on public.pm_pdf_settings;
create policy "pm_pdf_settings_admin_all_insert" on public.pm_pdf_settings
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "pm_pdf_settings_admin_all_update" on public.pm_pdf_settings;
create policy "pm_pdf_settings_admin_all_update" on public.pm_pdf_settings
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "pm_pdf_settings_select_combined" on public.pm_pdf_settings;
create policy "pm_pdf_settings_select_combined" on public.pm_pdf_settings
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- whatsapp_settings (edge functions use service role and bypass RLS; this scopes the admin-facing authenticated path)
drop policy "whatsapp_settings_admin_read" on public.whatsapp_settings;
create policy "whatsapp_settings_admin_read" on public.whatsapp_settings
  for select to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "whatsapp_settings_admin_update" on public.whatsapp_settings;
create policy "whatsapp_settings_admin_update" on public.whatsapp_settings
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));
