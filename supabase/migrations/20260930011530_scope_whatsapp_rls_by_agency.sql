drop policy "uwp_admin_delete" on public.user_whatsapp_preferences;
create policy "uwp_admin_delete" on public.user_whatsapp_preferences
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "uwp_self_read" on public.user_whatsapp_preferences;
create policy "uwp_self_read" on public.user_whatsapp_preferences
  for select to authenticated
  using ((user_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()));

drop policy "uwp_self_update" on public.user_whatsapp_preferences;
create policy "uwp_self_update" on public.user_whatsapp_preferences
  for update to authenticated
  using ((user_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()))
  with check ((user_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()));

drop policy "uwp_self_upsert" on public.user_whatsapp_preferences;
create policy "uwp_self_upsert" on public.user_whatsapp_preferences
  for insert to authenticated
  with check ((user_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()));

drop policy "whatsapp_automations_admin_all" on public.whatsapp_automations;
create policy "whatsapp_automations_admin_all" on public.whatsapp_automations
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "wa_contacts_admin_all" on public.whatsapp_contacts;
create policy "wa_contacts_admin_all" on public.whatsapp_contacts
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "wa_messages_admin_all" on public.whatsapp_messages;
create policy "wa_messages_admin_all" on public.whatsapp_messages
  for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "whatsapp_outbox_admin_read" on public.whatsapp_outbox;
create policy "whatsapp_outbox_admin_read" on public.whatsapp_outbox
  for select to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "ranking_state_admin_select" on public.whatsapp_ranking_state;
create policy "ranking_state_admin_select" on public.whatsapp_ranking_state
  for select to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "whatsapp_send_log_self_read" on public.whatsapp_send_log;
create policy "whatsapp_send_log_self_read" on public.whatsapp_send_log
  for select to authenticated
  using ((user_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()));
