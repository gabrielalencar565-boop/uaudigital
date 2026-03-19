
-- Enable realtime for tables not yet in the publication
-- Using IF NOT EXISTS pattern via DO block to avoid errors for already-added tables

DO $$
BEGIN
  -- pm_activity_log
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pm_activity_log') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_activity_log;
  END IF;
  -- pm_attachments
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pm_attachments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_attachments;
  END IF;
  -- pm_projects
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pm_projects') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_projects;
  END IF;
  -- pm_stage_flows
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pm_stage_flows') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_stage_flows;
  END IF;
  -- pm_cronograma_feedback
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pm_cronograma_feedback') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_cronograma_feedback;
  END IF;
  -- pm_tags
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pm_tags') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_tags;
  END IF;
  -- pm_pdf_settings
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pm_pdf_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_pdf_settings;
  END IF;
  -- scoring_config
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'scoring_config') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scoring_config;
  END IF;
  -- internal_dates
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'internal_dates') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_dates;
  END IF;
  -- health_scores
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'health_scores') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.health_scores;
  END IF;
  -- financial tables
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'financial_clients') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_clients;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'financial_expenses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_expenses;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'financial_revenues') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_revenues;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'financial_goals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_goals;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'financial_transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_transactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'financial_credit_cards') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_credit_cards;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'squads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.squads;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'squad_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_members;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'client_squads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_squads;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'mrr_movements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mrr_movements;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'task_activity_log') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_activity_log;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'health_score_tokens') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.health_score_tokens;
  END IF;
END $$;
