drop policy "calendar_publications_admin_all" on public.calendar_publications;
create policy "calendar_publications_admin_all" on public.calendar_publications
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "calendar_publications_delete_auth" on public.calendar_publications;
create policy "calendar_publications_delete_auth" on public.calendar_publications
  for delete to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "calendar_publications_planner_insert" on public.calendar_publications;
create policy "calendar_publications_planner_insert" on public.calendar_publications
  for insert to authenticated
  with check (has_feature_permission((select auth.uid()), 'action_manage_publications'::text) and agency_id = (select public.current_agency_id()));

drop policy "calendar_publications_select" on public.calendar_publications;
create policy "calendar_publications_select" on public.calendar_publications
  for select to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "calendar_publications_update_auth" on public.calendar_publications;
create policy "calendar_publications_update_auth" on public.calendar_publications
  for update to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "publication_calendars_admin_all" on public.publication_calendars;
create policy "publication_calendars_admin_all" on public.publication_calendars
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "publication_calendars_planner_insert" on public.publication_calendars;
create policy "publication_calendars_planner_insert" on public.publication_calendars
  for insert to authenticated
  with check (has_feature_permission((select auth.uid()), 'action_manage_publications'::text) and agency_id = (select public.current_agency_id()));

drop policy "publication_calendars_select" on public.publication_calendars;
create policy "publication_calendars_select" on public.publication_calendars
  for select to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "publication_calendars_update_auth" on public.publication_calendars;
create policy "publication_calendars_update_auth" on public.publication_calendars
  for update to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));
