
-- Add block configuration and footer/agency fields to pm_pdf_settings
ALTER TABLE public.pm_pdf_settings
  ADD COLUMN IF NOT EXISTS blocks_order jsonb NOT NULL DEFAULT '["cover","client_info","agenda","cards","footer"]'::jsonb,
  ADD COLUMN IF NOT EXISTS blocks_enabled jsonb NOT NULL DEFAULT '{"cover":true,"client_info":true,"agenda":true,"cards":true,"footer":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS agenda_layout text NOT NULL DEFAULT 'calendar',
  ADD COLUMN IF NOT EXISTS agency_logo_url text,
  ADD COLUMN IF NOT EXISTS agency_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footer_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footer_contact text NOT NULL DEFAULT '';
