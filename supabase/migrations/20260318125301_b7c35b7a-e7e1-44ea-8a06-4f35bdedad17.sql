ALTER TABLE public.pm_pdf_settings
  ADD COLUMN IF NOT EXISTS carousel_cols integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS carousel_rows integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS carousel_title_font_size integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS carousel_caption_font_size integer NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS carousel_date_font_size integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS carousel_image_height_pct integer NOT NULL DEFAULT 65;