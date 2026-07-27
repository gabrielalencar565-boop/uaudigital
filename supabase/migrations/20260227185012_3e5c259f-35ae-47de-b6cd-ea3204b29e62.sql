DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cleaning_categories; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cleaning_schedules; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cleaning_completions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
