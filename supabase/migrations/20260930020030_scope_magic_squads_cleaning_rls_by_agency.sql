-- cleaning_categories
drop policy "cleaning_categories_admin_all_delete" on public.cleaning_categories;
create policy "cleaning_categories_admin_all_delete" on public.cleaning_categories
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "cleaning_categories_admin_all_insert" on public.cleaning_categories;
create policy "cleaning_categories_admin_all_insert" on public.cleaning_categories
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "cleaning_categories_admin_all_update" on public.cleaning_categories;
create policy "cleaning_categories_admin_all_update" on public.cleaning_categories
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "cleaning_categories_select_combined" on public.cleaning_categories;
create policy "cleaning_categories_select_combined" on public.cleaning_categories
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- cleaning_completions
drop policy "cleaning_completions_admin_all_update" on public.cleaning_completions;
create policy "cleaning_completions_admin_all_update" on public.cleaning_completions
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "cleaning_completions_delete_combined" on public.cleaning_completions;
create policy "cleaning_completions_delete_combined" on public.cleaning_completions
  for delete to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or completed_by = (select auth.uid())) and agency_id = (select public.current_agency_id()));

drop policy "cleaning_completions_insert_combined" on public.cleaning_completions;
create policy "cleaning_completions_insert_combined" on public.cleaning_completions
  for insert to authenticated
  with check ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "cleaning_completions_select_combined" on public.cleaning_completions;
create policy "cleaning_completions_select_combined" on public.cleaning_completions
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- cleaning_schedules
drop policy "cleaning_schedules_admin_all_delete" on public.cleaning_schedules;
create policy "cleaning_schedules_admin_all_delete" on public.cleaning_schedules
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "cleaning_schedules_admin_all_insert" on public.cleaning_schedules;
create policy "cleaning_schedules_admin_all_insert" on public.cleaning_schedules
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "cleaning_schedules_admin_all_update" on public.cleaning_schedules;
create policy "cleaning_schedules_admin_all_update" on public.cleaning_schedules
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "cleaning_schedules_select_combined" on public.cleaning_schedules;
create policy "cleaning_schedules_select_combined" on public.cleaning_schedules
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- client_squads
drop policy "client_squads_admin_all_delete" on public.client_squads;
create policy "client_squads_admin_all_delete" on public.client_squads
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "client_squads_admin_all_insert" on public.client_squads;
create policy "client_squads_admin_all_insert" on public.client_squads
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "client_squads_admin_all_update" on public.client_squads;
create policy "client_squads_admin_all_update" on public.client_squads
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "client_squads_select_combined" on public.client_squads;
create policy "client_squads_select_combined" on public.client_squads
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- magic2_client_links
drop policy "magic2_client_links_delete_admin" on public.magic2_client_links;
create policy "magic2_client_links_delete_admin" on public.magic2_client_links
  for delete to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "magic2_client_links_insert_authenticated" on public.magic2_client_links;
create policy "magic2_client_links_insert_authenticated" on public.magic2_client_links
  for insert to public
  with check ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "magic2_client_links_select_authenticated" on public.magic2_client_links;
create policy "magic2_client_links_select_authenticated" on public.magic2_client_links
  for select to public
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

-- magic2_clients
drop policy "magic2_clients_admin_all_delete" on public.magic2_clients;
create policy "magic2_clients_admin_all_delete" on public.magic2_clients
  for delete to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "magic2_clients_insert_combined" on public.magic2_clients;
create policy "magic2_clients_insert_combined" on public.magic2_clients
  for insert to public
  with check ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "magic2_clients_select_combined" on public.magic2_clients;
create policy "magic2_clients_select_combined" on public.magic2_clients
  for select to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "magic2_clients_update_combined" on public.magic2_clients;
create policy "magic2_clients_update_combined" on public.magic2_clients
  for update to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- magic2_cycle_stages
drop policy "magic2_cycle_stages_admin_all_delete" on public.magic2_cycle_stages;
create policy "magic2_cycle_stages_admin_all_delete" on public.magic2_cycle_stages
  for delete to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "magic2_cycle_stages_insert_combined" on public.magic2_cycle_stages;
create policy "magic2_cycle_stages_insert_combined" on public.magic2_cycle_stages
  for insert to public
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and exists (select 1 from magic2_cycles c where c.id = magic2_cycle_stages.cycle_id and c.due_date = make_date(c.year, c.month, 27) and c.month >= 1 and c.month <= 12 and c.year >= 2000 and c.year <= 2100))) and agency_id = (select public.current_agency_id()));

drop policy "magic2_cycle_stages_select_combined" on public.magic2_cycle_stages;
create policy "magic2_cycle_stages_select_combined" on public.magic2_cycle_stages
  for select to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "magic2_cycle_stages_update_combined" on public.magic2_cycle_stages;
create policy "magic2_cycle_stages_update_combined" on public.magic2_cycle_stages
  for update to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and exists (select 1 from magic2_cycles c where c.id = magic2_cycle_stages.cycle_id and c.due_date = make_date(c.year, c.month, 27) and c.month >= 1 and c.month <= 12 and c.year >= 2000 and c.year <= 2100))) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and exists (select 1 from magic2_cycles c where c.id = magic2_cycle_stages.cycle_id and c.due_date = make_date(c.year, c.month, 27) and c.month >= 1 and c.month <= 12 and c.year >= 2000 and c.year <= 2100))) and agency_id = (select public.current_agency_id()));

-- magic2_cycles
drop policy "magic2_cycles_admin_all_delete" on public.magic2_cycles;
create policy "magic2_cycles_admin_all_delete" on public.magic2_cycles
  for delete to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "magic2_cycles_insert_combined" on public.magic2_cycles;
create policy "magic2_cycles_insert_combined" on public.magic2_cycles
  for insert to public
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and month >= 1 and month <= 12 and year >= 2000 and year <= 2100 and due_date = make_date(year, month, 27))) and agency_id = (select public.current_agency_id()));

drop policy "magic2_cycles_select_combined" on public.magic2_cycles;
create policy "magic2_cycles_select_combined" on public.magic2_cycles
  for select to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "magic2_cycles_update_combined" on public.magic2_cycles;
create policy "magic2_cycles_update_combined" on public.magic2_cycles
  for update to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and month >= 1 and month <= 12 and year >= 2000 and year <= 2100 and due_date = make_date(year, month, 27))) and agency_id = (select public.current_agency_id()));

-- squad_members
drop policy "squad_members_admin_all_delete" on public.squad_members;
create policy "squad_members_admin_all_delete" on public.squad_members
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "squad_members_admin_all_insert" on public.squad_members;
create policy "squad_members_admin_all_insert" on public.squad_members
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "squad_members_admin_all_update" on public.squad_members;
create policy "squad_members_admin_all_update" on public.squad_members
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "squad_members_select_combined" on public.squad_members;
create policy "squad_members_select_combined" on public.squad_members
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- squads
drop policy "squads_admin_all_delete" on public.squads;
create policy "squads_admin_all_delete" on public.squads
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "squads_admin_all_insert" on public.squads;
create policy "squads_admin_all_insert" on public.squads
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "squads_admin_all_update" on public.squads;
create policy "squads_admin_all_update" on public.squads
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "squads_select_combined" on public.squads;
create policy "squads_select_combined" on public.squads
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));
