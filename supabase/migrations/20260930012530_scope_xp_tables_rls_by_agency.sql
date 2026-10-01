-- reward_levels
drop policy "reward_levels_admin_all_delete" on public.reward_levels;
create policy "reward_levels_admin_all_delete" on public.reward_levels
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "reward_levels_admin_all_insert" on public.reward_levels;
create policy "reward_levels_admin_all_insert" on public.reward_levels
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "reward_levels_admin_all_update" on public.reward_levels;
create policy "reward_levels_admin_all_update" on public.reward_levels
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "reward_levels_select_combined" on public.reward_levels;
create policy "reward_levels_select_combined" on public.reward_levels
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- reward_redemptions
drop policy "reward_redemptions_admin_all_delete" on public.reward_redemptions;
create policy "reward_redemptions_admin_all_delete" on public.reward_redemptions
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "reward_redemptions_admin_all_update" on public.reward_redemptions;
create policy "reward_redemptions_admin_all_update" on public.reward_redemptions
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "reward_redemptions_insert_combined" on public.reward_redemptions;
create policy "reward_redemptions_insert_combined" on public.reward_redemptions
  for insert to authenticated
  with check ((has_role((select auth.uid()), 'admin'::app_role) or (user_id = (select auth.uid()))) and agency_id = (select public.current_agency_id()));

drop policy "reward_redemptions_select_combined" on public.reward_redemptions;
create policy "reward_redemptions_select_combined" on public.reward_redemptions
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or ((user_id = (select auth.uid())) or has_role((select auth.uid()), 'admin'::app_role))) and agency_id = (select public.current_agency_id()));

-- rewards
drop policy "rewards_admin_all_delete" on public.rewards;
create policy "rewards_admin_all_delete" on public.rewards
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "rewards_admin_all_insert" on public.rewards;
create policy "rewards_admin_all_insert" on public.rewards
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "rewards_admin_all_update" on public.rewards;
create policy "rewards_admin_all_update" on public.rewards
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "rewards_select_combined" on public.rewards;
create policy "rewards_select_combined" on public.rewards
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- user_xp_events
drop policy "user_xp_events_admin_all_delete" on public.user_xp_events;
create policy "user_xp_events_admin_all_delete" on public.user_xp_events
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "user_xp_events_admin_all_insert" on public.user_xp_events;
create policy "user_xp_events_admin_all_insert" on public.user_xp_events
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "user_xp_events_admin_all_update" on public.user_xp_events;
create policy "user_xp_events_admin_all_update" on public.user_xp_events
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "user_xp_events_select_combined" on public.user_xp_events;
create policy "user_xp_events_select_combined" on public.user_xp_events
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or ((user_id = (select auth.uid())) or has_role((select auth.uid()), 'admin'::app_role))) and agency_id = (select public.current_agency_id()));

-- xp_criteria
drop policy "xp_criteria_admin_all_delete" on public.xp_criteria;
create policy "xp_criteria_admin_all_delete" on public.xp_criteria
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_criteria_admin_all_insert" on public.xp_criteria;
create policy "xp_criteria_admin_all_insert" on public.xp_criteria
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_criteria_admin_all_update" on public.xp_criteria;
create policy "xp_criteria_admin_all_update" on public.xp_criteria
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_criteria_select_combined" on public.xp_criteria;
create policy "xp_criteria_select_combined" on public.xp_criteria
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- xp_monthly_processing
drop policy "xp_monthly_processing_admin_delete" on public.xp_monthly_processing;
create policy "xp_monthly_processing_admin_delete" on public.xp_monthly_processing
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_monthly_processing_admin_insert" on public.xp_monthly_processing;
create policy "xp_monthly_processing_admin_insert" on public.xp_monthly_processing
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_monthly_processing_admin_update" on public.xp_monthly_processing;
create policy "xp_monthly_processing_admin_update" on public.xp_monthly_processing
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_monthly_processing_select_combined" on public.xp_monthly_processing;
create policy "xp_monthly_processing_select_combined" on public.xp_monthly_processing
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));

-- xp_task_penalties
drop policy "xp_task_penalties_admin_delete" on public.xp_task_penalties;
create policy "xp_task_penalties_admin_delete" on public.xp_task_penalties
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_task_penalties_admin_update" on public.xp_task_penalties;
create policy "xp_task_penalties_admin_update" on public.xp_task_penalties
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_task_penalties_select_combined" on public.xp_task_penalties;
create policy "xp_task_penalties_select_combined" on public.xp_task_penalties
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or ((user_id = (select auth.uid())) or has_role((select auth.uid()), 'admin'::app_role))) and agency_id = (select public.current_agency_id()));

-- xp_video_destaque
drop policy "xp_video_destaque_admin_delete" on public.xp_video_destaque;
create policy "xp_video_destaque_admin_delete" on public.xp_video_destaque
  for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_video_destaque_admin_insert" on public.xp_video_destaque;
create policy "xp_video_destaque_admin_insert" on public.xp_video_destaque
  for insert to authenticated
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_video_destaque_admin_update" on public.xp_video_destaque;
create policy "xp_video_destaque_admin_update" on public.xp_video_destaque
  for update to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()))
  with check (has_role((select auth.uid()), 'admin'::app_role) and agency_id = (select public.current_agency_id()));

drop policy "xp_video_destaque_select_combined" on public.xp_video_destaque;
create policy "xp_video_destaque_select_combined" on public.xp_video_destaque
  for select to authenticated
  using ((has_role((select auth.uid()), 'admin'::app_role) or (select auth.uid()) is not null) and agency_id = (select public.current_agency_id()));
