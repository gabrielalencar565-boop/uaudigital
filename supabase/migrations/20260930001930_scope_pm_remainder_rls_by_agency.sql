-- pm_activity_log
drop policy "pm_activity_log_insert_auth" on public.pm_activity_log;
create policy "pm_activity_log_insert_auth" on public.pm_activity_log
  for insert to authenticated
  with check ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "pm_activity_log_select" on public.pm_activity_log;
create policy "pm_activity_log_select" on public.pm_activity_log
  for select to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

-- pm_attachments
drop policy "pm_attachments_delete" on public.pm_attachments;
create policy "pm_attachments_delete" on public.pm_attachments
  for delete to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "pm_attachments_insert_auth" on public.pm_attachments;
create policy "pm_attachments_insert_auth" on public.pm_attachments
  for insert to authenticated
  with check ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "pm_attachments_select" on public.pm_attachments;
create policy "pm_attachments_select" on public.pm_attachments
  for select to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "pm_attachments_update_auth" on public.pm_attachments;
create policy "pm_attachments_update_auth" on public.pm_attachments
  for update to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

-- pm_comments
drop policy "pm_comments_delete" on public.pm_comments;
create policy "pm_comments_delete" on public.pm_comments
  for delete to authenticated
  using ((author_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'::app_role)) and agency_id = (select public.current_agency_id()));

drop policy "pm_comments_insert_auth" on public.pm_comments;
create policy "pm_comments_insert_auth" on public.pm_comments
  for insert to authenticated
  with check ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "pm_comments_select" on public.pm_comments;
create policy "pm_comments_select" on public.pm_comments
  for select to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

-- pm_cronograma_feedback
drop policy "pm_cronograma_feedback_auth_insert" on public.pm_cronograma_feedback;
create policy "pm_cronograma_feedback_auth_insert" on public.pm_cronograma_feedback
  for insert to authenticated
  with check ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "pm_cronograma_feedback_auth_select" on public.pm_cronograma_feedback;
create policy "pm_cronograma_feedback_auth_select" on public.pm_cronograma_feedback
  for select to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "pm_cronograma_feedback_auth_update" on public.pm_cronograma_feedback;
create policy "pm_cronograma_feedback_auth_update" on public.pm_cronograma_feedback
  for update to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()))
  with check ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

-- pm_projects
drop policy "pm_projects_admin_all_delete" on public.pm_projects;
create policy "pm_projects_admin_all_delete" on public.pm_projects
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "pm_projects_admin_all_update" on public.pm_projects;
create policy "pm_projects_admin_all_update" on public.pm_projects
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "pm_projects_insert_combined" on public.pm_projects;
create policy "pm_projects_insert_combined" on public.pm_projects
  for insert to authenticated
  with check (has_feature_permission((select auth.uid()), 'action_manage_projects'::text) and agency_id = (select public.current_agency_id()));

drop policy "pm_projects_select_combined" on public.pm_projects;
create policy "pm_projects_select_combined" on public.pm_projects
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- pm_stage_flows
drop policy "pm_stage_flows_admin_all_delete" on public.pm_stage_flows;
create policy "pm_stage_flows_admin_all_delete" on public.pm_stage_flows
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "pm_stage_flows_admin_all_insert" on public.pm_stage_flows;
create policy "pm_stage_flows_admin_all_insert" on public.pm_stage_flows
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "pm_stage_flows_admin_all_update" on public.pm_stage_flows;
create policy "pm_stage_flows_admin_all_update" on public.pm_stage_flows
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "pm_stage_flows_select_combined" on public.pm_stage_flows;
create policy "pm_stage_flows_select_combined" on public.pm_stage_flows
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- pm_subtasks
drop policy "pm_subtasks_admin_all_delete" on public.pm_subtasks;
create policy "pm_subtasks_admin_all_delete" on public.pm_subtasks
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "pm_subtasks_delete_auth" on public.pm_subtasks;
create policy "pm_subtasks_delete_auth" on public.pm_subtasks
  for delete to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "pm_subtasks_insert_combined" on public.pm_subtasks;
create policy "pm_subtasks_insert_combined" on public.pm_subtasks
  for insert to authenticated
  with check ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "pm_subtasks_select_combined" on public.pm_subtasks;
create policy "pm_subtasks_select_combined" on public.pm_subtasks
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "pm_subtasks_update_combined" on public.pm_subtasks;
create policy "pm_subtasks_update_combined" on public.pm_subtasks
  for update to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- pm_tags
drop policy "pm_tags_delete_admin" on public.pm_tags;
create policy "pm_tags_delete_admin" on public.pm_tags
  for delete to authenticated
  using (has_feature_permission((select auth.uid()), 'action_manage_tags'::text) and agency_id = (select public.current_agency_id()));

drop policy "pm_tags_insert_auth" on public.pm_tags;
create policy "pm_tags_insert_auth" on public.pm_tags
  for insert to authenticated
  with check ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "pm_tags_select_auth" on public.pm_tags;
create policy "pm_tags_select_auth" on public.pm_tags
  for select to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "pm_tags_update_admin" on public.pm_tags;
create policy "pm_tags_update_admin" on public.pm_tags
  for update to authenticated
  using (has_feature_permission((select auth.uid()), 'action_manage_tags'::text) and agency_id = (select public.current_agency_id()));
