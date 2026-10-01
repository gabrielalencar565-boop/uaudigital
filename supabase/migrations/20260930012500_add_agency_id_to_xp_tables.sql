alter table public.reward_levels add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.rewards add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.user_xp_events add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.reward_redemptions add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.xp_criteria add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.xp_monthly_processing add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.xp_task_penalties add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.xp_video_destaque add column agency_id uuid references public.agencies(id) default public.current_agency_id();
