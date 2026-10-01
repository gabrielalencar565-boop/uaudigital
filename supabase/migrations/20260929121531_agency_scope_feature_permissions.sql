alter table public.feature_permissions
  add column agency_id uuid references public.agencies(id) default public.current_agency_id();

update public.feature_permissions
set agency_id = (select id from public.agencies where slug = 'uau-digital')
where agency_id is null;

drop policy "feature_permissions_admin_write" on public.feature_permissions;
create policy "feature_permissions_admin_write" on public.feature_permissions
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) and agency_id = public.current_agency_id())
  with check (has_role(auth.uid(), 'admin'::app_role) and agency_id = public.current_agency_id());

drop policy "feature_permissions_select_authenticated" on public.feature_permissions;
create policy "feature_permissions_select_authenticated" on public.feature_permissions
  for select to authenticated
  using (agency_id = public.current_agency_id());
