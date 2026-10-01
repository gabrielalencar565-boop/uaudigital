drop policy "Admins manage clients_delete" on public.clients;
create policy "Admins manage clients_delete" on public.clients
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage clients_insert" on public.clients;
create policy "Admins manage clients_insert" on public.clients
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "clients_select_combined" on public.clients;
create policy "clients_select_combined" on public.clients
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage clients_update" on public.clients;
create policy "Admins manage clients_update" on public.clients
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));
