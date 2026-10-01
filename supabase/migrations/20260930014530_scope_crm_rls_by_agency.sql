drop policy "Admins manage crm activity" on public.crm_activity_log;
create policy "Admins manage crm activity" on public.crm_activity_log
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage crm_lead_automations" on public.crm_lead_automations;
create policy "Admins manage crm_lead_automations" on public.crm_lead_automations
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins read welcome log" on public.crm_lead_welcome_log;
create policy "Admins read welcome log" on public.crm_lead_welcome_log
  for select to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage leads" on public.crm_leads;
create policy "Admins manage leads" on public.crm_leads
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage crm proposals" on public.crm_proposals;
create policy "Admins manage crm proposals" on public.crm_proposals
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage crm tasks" on public.crm_tasks;
create policy "Admins manage crm tasks" on public.crm_tasks
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));
