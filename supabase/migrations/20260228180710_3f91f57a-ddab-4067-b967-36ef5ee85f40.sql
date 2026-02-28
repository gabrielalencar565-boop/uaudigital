ALTER TABLE public.performance_scores 
  ADD COLUMN video_destaque integer NOT NULL DEFAULT 0,
  ADD COLUMN squad_destaque integer NOT NULL DEFAULT 0;