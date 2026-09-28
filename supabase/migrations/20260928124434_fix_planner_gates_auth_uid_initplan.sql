-- Segue o mesmo padrão já usado em outras tabelas deste projeto (fix_rls_auth_uid_initplan,
-- fix_calendar_rls_initplan_performance): envolve auth.uid() em (select ...) pra Postgres
-- avaliar uma vez por query em vez de reavaliar por linha. Mesmo comportamento, só melhora
-- o plano de execução -- aplicado só nas 12 políticas reescritas na migration anterior.

alter policy "calendar_publications_planner_insert" on public.calendar_publications
  with check (public.has_feature_permission((select auth.uid()), 'action_manage_publications'));

alter policy "publication_calendars_planner_insert" on public.publication_calendars
  with check (public.has_feature_permission((select auth.uid()), 'action_manage_publications'));

alter policy "pm_projects_insert_combined" on public.pm_projects
  with check (public.has_feature_permission((select auth.uid()), 'action_manage_projects'));

alter policy "pm_tags_update_admin" on public.pm_tags
  using (public.has_feature_permission((select auth.uid()), 'action_manage_tags'));

alter policy "pm_tags_delete_admin" on public.pm_tags
  using (public.has_feature_permission((select auth.uid()), 'action_manage_tags'));

alter policy "Users view own appeals" on public.task_appeals
  using (((select auth.uid()) = user_id) or public.has_feature_permission((select auth.uid()), 'action_manage_appeals'));

alter policy "Admins manage appeals" on public.task_appeals
  using (public.has_feature_permission((select auth.uid()), 'action_manage_appeals'))
  with check (public.has_feature_permission((select auth.uid()), 'action_manage_appeals'));

alter policy "task_assignees_insert_combined" on public.task_assignees
  with check (public.has_feature_permission((select auth.uid()), 'action_manage_tasks'));

alter policy "task_assignees_update_combined" on public.task_assignees
  using (public.has_feature_permission((select auth.uid()), 'action_manage_tasks'))
  with check (public.has_feature_permission((select auth.uid()), 'action_manage_tasks'));

alter policy "task_assignees_delete_combined" on public.task_assignees
  using (public.has_feature_permission((select auth.uid()), 'action_manage_tasks') or ((select auth.uid()) = user_id));

alter policy "tasks_delete_combined" on public.tasks
  using (public.has_feature_permission((select auth.uid()), 'action_manage_tasks'));

alter policy "tasks_insert_combined" on public.tasks
  with check (public.has_feature_permission((select auth.uid()), 'action_manage_tasks') and (created_by = (select auth.uid())));
