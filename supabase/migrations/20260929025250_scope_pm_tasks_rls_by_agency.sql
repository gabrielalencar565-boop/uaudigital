drop policy "pm_tasks_admin_all_delete" on public.pm_tasks;
create policy "pm_tasks_admin_all_delete" on public.pm_tasks
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = public.current_agency_id());

drop policy "pm_tasks_insert_combined" on public.pm_tasks;
create policy "pm_tasks_insert_combined" on public.pm_tasks
  for insert to authenticated
  with check ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = public.current_agency_id());

drop policy "pm_tasks_select_combined" on public.pm_tasks;
create policy "pm_tasks_select_combined" on public.pm_tasks
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = public.current_agency_id());

drop policy "pm_tasks_update_combined" on public.pm_tasks;
create policy "pm_tasks_update_combined" on public.pm_tasks
  for update to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = public.current_agency_id())
  with check ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = public.current_agency_id());
