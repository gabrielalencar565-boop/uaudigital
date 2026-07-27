-- Enable realtime for tasks table
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable realtime for performance_scores table
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_scores; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable realtime for magic2_cycle_stages table
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.magic2_cycle_stages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable realtime for client_cycle_stages table
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.client_cycle_stages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
