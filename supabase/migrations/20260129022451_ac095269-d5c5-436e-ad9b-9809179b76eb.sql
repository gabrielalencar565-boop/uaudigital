-- Add logo_shape column to app_settings (circle or square)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'logo_shape_type'
  ) THEN
    CREATE TYPE public.logo_shape_type AS ENUM ('circle', 'square');
  END IF;
END $$;

ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS logo_shape public.logo_shape_type NOT NULL DEFAULT 'square';
