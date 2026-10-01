drop policy "client_cycles_insert_combined" on public.client_cycles;
create policy "client_cycles_insert_combined" on public.client_cycles
  for insert to public
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and month >= 1 and month <= 12 and year >= 2000 and year <= 2100 and due_date = make_date(year, month, (select public.current_magic_number_day())))) and agency_id = (select public.current_agency_id()));

drop policy "client_cycles_update_combined" on public.client_cycles;
create policy "client_cycles_update_combined" on public.client_cycles
  for update to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and month >= 1 and month <= 12 and year >= 2000 and year <= 2100 and due_date = make_date(year, month, (select public.current_magic_number_day())))) and agency_id = (select public.current_agency_id()));
