drop policy "Users can insert own team member" on public.team_members;
create policy "Users can insert own team member" on public.team_members
  for insert to authenticated
  with check (((select auth.uid()) = user_id or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()));

drop policy "Team members readable by authenticated" on public.team_members;
create policy "Team members readable by authenticated" on public.team_members
  for select to authenticated
  using (agency_id = (select public.current_agency_id()));

drop policy "Users can update own team member" on public.team_members;
create policy "Users can update own team member" on public.team_members
  for update to authenticated
  using (((select auth.uid()) = user_id or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()))
  with check (((select auth.uid()) = user_id or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()));
