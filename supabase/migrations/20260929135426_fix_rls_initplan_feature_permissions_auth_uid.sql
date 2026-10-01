drop policy "feature_permissions_admin_write" on public.feature_permissions;
create policy "feature_permissions_admin_write" on public.feature_permissions
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));
