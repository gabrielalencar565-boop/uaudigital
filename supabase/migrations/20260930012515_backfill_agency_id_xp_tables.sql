update public.reward_levels set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.rewards set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.user_xp_events set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.reward_redemptions set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.xp_criteria set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.xp_monthly_processing set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.xp_task_penalties set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
update public.xp_video_destaque set agency_id = (select id from public.agencies where slug = 'uau-digital') where agency_id is null;
