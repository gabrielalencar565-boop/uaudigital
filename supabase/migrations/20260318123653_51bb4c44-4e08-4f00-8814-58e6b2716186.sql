
ALTER TABLE public.pm_pdf_settings
  ADD COLUMN IF NOT EXISTS footer_title_font_size integer NOT NULL DEFAULT 32,
  ADD COLUMN IF NOT EXISTS footer_subtitle_font_size integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS footer_contact_font_size integer NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS card_image_width_pct integer NOT NULL DEFAULT 45;
