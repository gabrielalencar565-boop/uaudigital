create index if not exists reward_levels_agency_id_idx on public.reward_levels (agency_id);
create index if not exists rewards_agency_id_idx on public.rewards (agency_id);
create index if not exists user_xp_events_agency_id_idx on public.user_xp_events (agency_id);
create index if not exists reward_redemptions_agency_id_idx on public.reward_redemptions (agency_id);
create index if not exists xp_criteria_agency_id_idx on public.xp_criteria (agency_id);
create index if not exists xp_monthly_processing_agency_id_idx on public.xp_monthly_processing (agency_id);
create index if not exists xp_task_penalties_agency_id_idx on public.xp_task_penalties (agency_id);
create index if not exists xp_video_destaque_agency_id_idx on public.xp_video_destaque (agency_id);
