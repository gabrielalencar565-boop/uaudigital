-- Enable realtime for remaining key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_cycles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.magic2_cycles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_deadline_overrides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.magic2_clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.magic2_client_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;