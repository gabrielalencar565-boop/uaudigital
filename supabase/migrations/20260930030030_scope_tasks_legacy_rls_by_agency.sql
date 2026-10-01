-- client_cycle_stages
drop policy "Admins manage client cycle stages_delete" on public.client_cycle_stages;
create policy "Admins manage client cycle stages_delete" on public.client_cycle_stages
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "client_cycle_stages_insert_combined" on public.client_cycle_stages;
create policy "client_cycle_stages_insert_combined" on public.client_cycle_stages
  for insert to public
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and stage = any (array['captacao'::stage_type, 'edicao_videos'::stage_type, 'planejamento'::stage_type, 'design'::stage_type, 'revisao'::stage_type, 'pdf'::stage_type, 'entrega'::stage_type, 'alteracoes'::stage_type, 'agendamento'::stage_type]) and exists (select 1 from client_cycles cc where cc.id = client_cycle_stages.cycle_id and cc.due_date = make_date(cc.year, cc.month, 27) and cc.month >= 1 and cc.month <= 12 and cc.year >= 2000 and cc.year <= 2100))) and agency_id = (select public.current_agency_id()));

drop policy "client_cycle_stages_select_combined" on public.client_cycle_stages;
create policy "client_cycle_stages_select_combined" on public.client_cycle_stages
  for select to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "client_cycle_stages_update_combined" on public.client_cycle_stages;
create policy "client_cycle_stages_update_combined" on public.client_cycle_stages
  for update to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and stage = any (array['captacao'::stage_type, 'edicao_videos'::stage_type, 'planejamento'::stage_type, 'design'::stage_type, 'revisao'::stage_type, 'pdf'::stage_type, 'entrega'::stage_type, 'alteracoes'::stage_type, 'agendamento'::stage_type]) and exists (select 1 from client_cycles cc where cc.id = client_cycle_stages.cycle_id and cc.due_date = make_date(cc.year, cc.month, 27) and cc.month >= 1 and cc.month <= 12 and cc.year >= 2000 and cc.year <= 2100))) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and stage = any (array['captacao'::stage_type, 'edicao_videos'::stage_type, 'planejamento'::stage_type, 'design'::stage_type, 'revisao'::stage_type, 'pdf'::stage_type, 'entrega'::stage_type, 'alteracoes'::stage_type, 'agendamento'::stage_type]) and exists (select 1 from client_cycles cc where cc.id = client_cycle_stages.cycle_id and cc.due_date = make_date(cc.year, cc.month, 27) and cc.month >= 1 and cc.month <= 12 and cc.year >= 2000 and cc.year <= 2100))) and agency_id = (select public.current_agency_id()));

-- client_cycles
drop policy "Admins manage client cycles_delete" on public.client_cycles;
create policy "Admins manage client cycles_delete" on public.client_cycles
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "client_cycles_insert_combined" on public.client_cycles;
create policy "client_cycles_insert_combined" on public.client_cycles
  for insert to public
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and month >= 1 and month <= 12 and year >= 2000 and year <= 2100 and due_date = make_date(year, month, 27))) and agency_id = (select public.current_agency_id()));

drop policy "client_cycles_select_combined" on public.client_cycles;
create policy "client_cycles_select_combined" on public.client_cycles
  for select to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "client_cycles_update_combined" on public.client_cycles;
create policy "client_cycles_update_combined" on public.client_cycles
  for update to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and month >= 1 and month <= 12 and year >= 2000 and year <= 2100 and due_date = make_date(year, month, 27))) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null and month >= 1 and month <= 12 and year >= 2000 and year <= 2100 and due_date = make_date(year, month, 27))) and agency_id = (select public.current_agency_id()));

-- client_stages
drop policy "Admins manage client stages_delete" on public.client_stages;
create policy "Admins manage client stages_delete" on public.client_stages
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage client stages_insert" on public.client_stages;
create policy "Admins manage client stages_insert" on public.client_stages
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "client_stages_select_combined" on public.client_stages;
create policy "client_stages_select_combined" on public.client_stages
  for select to authenticated
  using (agency_id = (select public.current_agency_id()));

drop policy "client_stages_update_combined" on public.client_stages;
create policy "client_stages_update_combined" on public.client_stages
  for update to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or exists (select 1 from tasks t where t.client_id = client_stages.client_id and t.stage = client_stages.stage and t.assigned_user_id = (select auth.uid()))) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or exists (select 1 from tasks t where t.client_id = client_stages.client_id and t.stage = client_stages.stage and t.assigned_user_id = (select auth.uid()))) and agency_id = (select public.current_agency_id()));

-- performance_scores
drop policy "Admins manage performance_delete" on public.performance_scores;
create policy "Admins manage performance_delete" on public.performance_scores
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage performance_insert" on public.performance_scores;
create policy "Admins manage performance_insert" on public.performance_scores
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage performance_update" on public.performance_scores;
create policy "Admins manage performance_update" on public.performance_scores
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "performance_scores_select_combined" on public.performance_scores;
create policy "performance_scores_select_combined" on public.performance_scores
  for select to authenticated
  using (agency_id = (select public.current_agency_id()));

-- task_activity_log
drop policy "task_activity_log_admin_delete" on public.task_activity_log;
create policy "task_activity_log_admin_delete" on public.task_activity_log
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "task_activity_log_admin_select" on public.task_activity_log;
create policy "task_activity_log_admin_select" on public.task_activity_log
  for select to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "task_activity_log_insert_authenticated" on public.task_activity_log;
create policy "task_activity_log_insert_authenticated" on public.task_activity_log
  for insert to authenticated
  with check ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

-- task_assignees
drop policy "task_assignees_delete_combined" on public.task_assignees;
create policy "task_assignees_delete_combined" on public.task_assignees
  for delete to public
  using ((has_feature_permission((select auth.uid()), 'action_manage_tasks'::text) or (select auth.uid()) = user_id) and agency_id = (select public.current_agency_id()));

drop policy "task_assignees_insert_combined" on public.task_assignees;
create policy "task_assignees_insert_combined" on public.task_assignees
  for insert to public
  with check (has_feature_permission((select auth.uid()), 'action_manage_tasks'::text) and agency_id = (select public.current_agency_id()));

drop policy "task_assignees_select_combined" on public.task_assignees;
create policy "task_assignees_select_combined" on public.task_assignees
  for select to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

drop policy "task_assignees_update_combined" on public.task_assignees;
create policy "task_assignees_update_combined" on public.task_assignees
  for update to public
  using (has_feature_permission((select auth.uid()), 'action_manage_tasks'::text) and agency_id = (select public.current_agency_id()))
  with check (has_feature_permission((select auth.uid()), 'action_manage_tasks'::text) and agency_id = (select public.current_agency_id()));

-- task_deadline_overrides
drop policy "Admins manage task deadline overrides_delete" on public.task_deadline_overrides;
create policy "Admins manage task deadline overrides_delete" on public.task_deadline_overrides
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage task deadline overrides_insert" on public.task_deadline_overrides;
create policy "Admins manage task deadline overrides_insert" on public.task_deadline_overrides
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "Admins manage task deadline overrides_update" on public.task_deadline_overrides;
create policy "Admins manage task deadline overrides_update" on public.task_deadline_overrides
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "task_deadline_overrides_select_combined" on public.task_deadline_overrides;
create policy "task_deadline_overrides_select_combined" on public.task_deadline_overrides
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- tasks
drop policy "Tasks readable by authenticated" on public.tasks;
create policy "Tasks readable by authenticated" on public.tasks
  for select to authenticated
  using ((select auth.uid()) is not null and agency_id = (select public.current_agency_id()));

drop policy "tasks_delete_combined" on public.tasks;
create policy "tasks_delete_combined" on public.tasks
  for delete to authenticated
  using (has_feature_permission((select auth.uid()), 'action_manage_tasks'::text) and agency_id = (select public.current_agency_id()));

drop policy "tasks_insert_combined" on public.tasks;
create policy "tasks_insert_combined" on public.tasks
  for insert to public
  with check (has_feature_permission((select auth.uid()), 'action_manage_tasks'::text) and created_by = (select auth.uid()) and agency_id = (select public.current_agency_id()));

drop policy "tasks_update_combined" on public.tasks;
create policy "tasks_update_combined" on public.tasks
  for update to public
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()))
  with check ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));
