-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_cycle_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_cycles;