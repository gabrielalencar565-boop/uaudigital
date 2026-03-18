ALTER TABLE public.pm_pdf_settings
  ADD COLUMN IF NOT EXISTS layout_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;