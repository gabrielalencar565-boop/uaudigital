drop policy "magic2_cycles_insert_combined" on public.magic2_cycles;
create policy "magic2_cycles_insert_combined" on public.magic2_cycles
  for insert to public
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and month >= 1 and month <= 12 and year >= 2000 and year <= 2100 and due_date = make_date(year, month, (select public.current_magic_number_day())))) and agency_id = (select public.current_agency_id()));

drop policy "magic2_cycles_update_combined" on public.magic2_cycles;
create policy "magic2_cycles_update_combined" on public.magic2_cycles
  for update to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and month >= 1 and month <= 12 and year >= 2000 and year <= 2100 and due_date = make_date(year, month, (select public.current_magic_number_day())))) and agency_id = (select public.current_agency_id()));

drop policy "magic2_cycle_stages_insert_combined" on public.magic2_cycle_stages;
create policy "magic2_cycle_stages_insert_combined" on public.magic2_cycle_stages
  for insert to public
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and exists (select 1 from magic2_cycles c where c.id = magic2_cycle_stages.cycle_id and c.due_date = make_date(c.year, c.month, (select public.current_magic_number_day())) and c.month >= 1 and c.month <= 12 and c.year >= 2000 and c.year <= 2100))) and agency_id = (select public.current_agency_id()));

drop policy "magic2_cycle_stages_update_combined" on public.magic2_cycle_stages;
create policy "magic2_cycle_stages_update_combined" on public.magic2_cycle_stages
  for update to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and exists (select 1 from magic2_cycles c where c.id = magic2_cycle_stages.cycle_id and c.due_date = make_date(c.year, c.month, (select public.current_magic_number_day())) and c.month >= 1 and c.month <= 12 and c.year >= 2000 and c.year <= 2100))) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and exists (select 1 from magic2_cycles c where c.id = magic2_cycle_stages.cycle_id and c.due_date = make_date(c.year, c.month, (select public.current_magic_number_day())) and c.month >= 1 and c.month <= 12 and c.year >= 2000 and c.year <= 2100))) and agency_id = (select public.current_agency_id()));
