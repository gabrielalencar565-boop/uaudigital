-- access_requests
drop policy "Admins can update access requests" on public.access_requests;
create policy "Admins can update access requests" on public.access_requests
  for update to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Users can request access" on public.access_requests;
create policy "Users can request access" on public.access_requests
  for insert to public
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id and agency_id = (select public.current_agency_id()));

drop policy "access_requests_select_combined" on public.access_requests;
create policy "access_requests_select_combined" on public.access_requests
  for select to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and (select auth.uid()) = user_id)) and agency_id = (select public.current_agency_id()));

-- health_score_tokens
drop policy "health_score_tokens_admin_all_delete" on public.health_score_tokens;
create policy "health_score_tokens_admin_all_delete" on public.health_score_tokens
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "health_score_tokens_admin_all_update" on public.health_score_tokens;
create policy "health_score_tokens_admin_all_update" on public.health_score_tokens
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "health_score_tokens_insert_combined" on public.health_score_tokens;
create policy "health_score_tokens_insert_combined" on public.health_score_tokens
  for insert to authenticated
  with check ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "health_score_tokens_select_combined" on public.health_score_tokens;
create policy "health_score_tokens_select_combined" on public.health_score_tokens
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- health_scores
drop policy "health_scores_admin_all_delete" on public.health_scores;
create policy "health_scores_admin_all_delete" on public.health_scores
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "health_scores_admin_all_insert" on public.health_scores;
create policy "health_scores_admin_all_insert" on public.health_scores
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "health_scores_admin_all_update" on public.health_scores;
create policy "health_scores_admin_all_update" on public.health_scores
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "health_scores_select_combined" on public.health_scores;
create policy "health_scores_select_combined" on public.health_scores
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- help_changelog_entries (fixing pre-existing unwrapped auth.uid())
drop policy "Anyone authenticated can read changelog entries" on public.help_changelog_entries;
create policy "Anyone authenticated can read changelog entries" on public.help_changelog_entries
  for select to authenticated
  using (agency_id = (select public.current_agency_id()));

drop policy "Permission-gated manage changelog entries" on public.help_changelog_entries;
create policy "Permission-gated manage changelog entries" on public.help_changelog_entries
  for all to public
  using (has_feature_permission((select auth.uid()), 'action_manage_changelog'::text) and agency_id = (select public.current_agency_id()))
  with check (has_feature_permission((select auth.uid()), 'action_manage_changelog'::text) and agency_id = (select public.current_agency_id()));

-- help_faq_items (fixing pre-existing unwrapped auth.uid())
drop policy "Anyone authenticated can read faq items" on public.help_faq_items;
create policy "Anyone authenticated can read faq items" on public.help_faq_items
  for select to authenticated
  using (agency_id = (select public.current_agency_id()));

drop policy "Permission-gated manage faq items" on public.help_faq_items;
create policy "Permission-gated manage faq items" on public.help_faq_items
  for all to public
  using (has_feature_permission((select auth.uid()), 'action_manage_faq'::text) and agency_id = (select public.current_agency_id()))
  with check (has_feature_permission((select auth.uid()), 'action_manage_faq'::text) and agency_id = (select public.current_agency_id()));

-- internal_dates
drop policy "internal_dates_admin_all_delete" on public.internal_dates;
create policy "internal_dates_admin_all_delete" on public.internal_dates
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "internal_dates_admin_all_insert" on public.internal_dates;
create policy "internal_dates_admin_all_insert" on public.internal_dates
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "internal_dates_admin_all_update" on public.internal_dates;
create policy "internal_dates_admin_all_update" on public.internal_dates
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "internal_dates_select_combined" on public.internal_dates;
create policy "internal_dates_select_combined" on public.internal_dates
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- notification_dismissals
drop policy "Users delete own dismissals" on public.notification_dismissals;
create policy "Users delete own dismissals" on public.notification_dismissals
  for delete to authenticated
  using (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()));

drop policy "Users insert own dismissals" on public.notification_dismissals;
create policy "Users insert own dismissals" on public.notification_dismissals
  for insert to authenticated
  with check (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()));

drop policy "Users read own dismissals" on public.notification_dismissals;
create policy "Users read own dismissals" on public.notification_dismissals
  for select to authenticated
  using (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()));

-- notification_reads
drop policy "Users can delete own notification_reads" on public.notification_reads;
create policy "Users can delete own notification_reads" on public.notification_reads
  for delete to authenticated
  using (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()));

drop policy "Users can insert own notification_reads" on public.notification_reads;
create policy "Users can insert own notification_reads" on public.notification_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()));

drop policy "Users can read own notification_reads" on public.notification_reads;
create policy "Users can read own notification_reads" on public.notification_reads
  for select to authenticated
  using (user_id = (select auth.uid()) and agency_id = (select public.current_agency_id()));

-- personal_notes (fixing pre-existing unwrapped auth.uid())
drop policy "Users manage their own notes" on public.personal_notes;
create policy "Users manage their own notes" on public.personal_notes
  for all to public
  using ((select auth.uid()) = user_id and agency_id = (select public.current_agency_id()))
  with check ((select auth.uid()) = user_id and agency_id = (select public.current_agency_id()));

-- problem_reports (fixing pre-existing unwrapped auth.uid())
drop policy "Developers can update problem reports" on public.problem_reports;
create policy "Developers can update problem reports" on public.problem_reports
  for update to authenticated
  using (has_role((select auth.uid()), 'developer'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'developer'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Users can insert own problem reports" on public.problem_reports;
create policy "Users can insert own problem reports" on public.problem_reports
  for insert to authenticated
  with check ((select auth.uid()) = user_id and agency_id = (select public.current_agency_id()));

drop policy "Users can view own problem reports" on public.problem_reports;
create policy "Users can view own problem reports" on public.problem_reports
  for select to authenticated
  using (((select auth.uid()) = user_id or has_role((select auth.uid()), 'developer'::app_role)) and agency_id = (select public.current_agency_id()));

-- push_subscriptions (fixing pre-existing unwrapped auth.uid())
drop policy "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions" on public.push_subscriptions
  for all to public
  using ((select auth.uid()) = user_id and agency_id = (select public.current_agency_id()))
  with check ((select auth.uid()) = user_id and agency_id = (select public.current_agency_id()));

-- task_appeals
drop policy "Admins delete appeals" on public.task_appeals;
create policy "Admins delete appeals" on public.task_appeals
  for delete to public
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage appeals" on public.task_appeals;
create policy "Admins manage appeals" on public.task_appeals
  for update to public
  using (has_feature_permission((select auth.uid()), 'action_manage_appeals'::text) and agency_id = (select public.current_agency_id()))
  with check (has_feature_permission((select auth.uid()), 'action_manage_appeals'::text) and agency_id = (select public.current_agency_id()));

drop policy "Users insert own appeals" on public.task_appeals;
create policy "Users insert own appeals" on public.task_appeals
  for insert to public
  with check ((select auth.uid()) = user_id and agency_id = (select public.current_agency_id()));

drop policy "Users view own appeals" on public.task_appeals;
create policy "Users view own appeals" on public.task_appeals
  for select to public
  using (((select auth.uid()) = user_id or has_feature_permission((select auth.uid()), 'action_manage_appeals'::text)) and agency_id = (select public.current_agency_id()));
