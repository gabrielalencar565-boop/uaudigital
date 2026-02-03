-- Enable realtime for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- Enable realtime for performance_scores table
ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_scores;

-- Enable realtime for magic2_cycle_stages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.magic2_cycle_stages;

-- Enable realtime for client_cycle_stages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_cycle_stages;