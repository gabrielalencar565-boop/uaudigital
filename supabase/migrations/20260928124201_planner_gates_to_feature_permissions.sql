-- Troca o gate hardcoded 'planner' pelas novas chaves de feature_permissions (only where
-- 'planner' is today's real/sole gate -- policies already opened via auth.uid() IS NOT NULL
-- are left untouched, no functional change there).

alter policy "calendar_publications_planner_insert" on public.calendar_publications
  with check (public.has_feature_permission(auth.uid(), 'action_manage_publications'));

alter policy "publication_calendars_planner_insert" on public.publication_calendars
  with check (public.has_feature_permission(auth.uid(), 'action_manage_publications'));

alter policy "pm_projects_insert_combined" on public.pm_projects
  with check (public.has_feature_permission(auth.uid(), 'action_manage_projects'));

alter policy "pm_tags_update_admin" on public.pm_tags
  using (public.has_feature_permission(auth.uid(), 'action_manage_tags'));

alter policy "pm_tags_delete_admin" on public.pm_tags
  using (public.has_feature_permission(auth.uid(), 'action_manage_tags'));

alter policy "Users view own appeals" on public.task_appeals
  using ((auth.uid() = user_id) or public.has_feature_permission(auth.uid(), 'action_manage_appeals'));

alter policy "Admins manage appeals" on public.task_appeals
  using (public.has_feature_permission(auth.uid(), 'action_manage_appeals'))
  with check (public.has_feature_permission(auth.uid(), 'action_manage_appeals'));

alter policy "task_assignees_insert_combined" on public.task_assignees
  with check (public.has_feature_permission(auth.uid(), 'action_manage_tasks'));

alter policy "task_assignees_update_combined" on public.task_assignees
  using (public.has_feature_permission(auth.uid(), 'action_manage_tasks'))
  with check (public.has_feature_permission(auth.uid(), 'action_manage_tasks'));

alter policy "task_assignees_delete_combined" on public.task_assignees
  using (public.has_feature_permission(auth.uid(), 'action_manage_tasks') or (auth.uid() = user_id));

alter policy "tasks_delete_combined" on public.tasks
  using (public.has_feature_permission(auth.uid(), 'action_manage_tasks'));

alter policy "tasks_insert_combined" on public.tasks
  with check (public.has_feature_permission(auth.uid(), 'action_manage_tasks') and (created_by = auth.uid()));
