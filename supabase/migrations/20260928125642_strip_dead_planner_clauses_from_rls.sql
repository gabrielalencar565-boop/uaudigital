-- Essas 3 políticas já liberavam qualquer usuário autenticado via "auth.uid() IS NOT NULL"
-- -- o trecho has_role(uid,'planner') era peso morto (nunca fazia diferença). Agora que
-- ninguém mais tem o papel 'planner', remove a cláusula pra não deixar referência a um
-- papel que não é mais atribuído a ninguém. Comportamento efetivo não muda.

alter policy "pm_tasks_insert_combined" on public.pm_tasks
  with check (has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null));

alter policy "task_assignees_select_combined" on public.task_assignees
  using (has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null));

alter policy "tasks_update_combined" on public.tasks
  using (has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null))
  with check (has_role((select auth.uid()), 'admin'::app_role) or ((select auth.uid()) is not null));
