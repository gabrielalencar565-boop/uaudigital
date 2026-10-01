drop policy "feature_permissions_admin_write" on public.feature_permissions;
create policy "feature_permissions_admin_write" on public.feature_permissions
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role(auth.uid(), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "feature_permissions_select_authenticated" on public.feature_permissions;
create policy "feature_permissions_select_authenticated" on public.feature_permissions
  for select to authenticated
  using (agency_id = (select public.current_agency_id()));
