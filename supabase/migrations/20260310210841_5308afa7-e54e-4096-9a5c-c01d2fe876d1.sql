
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS login_bg_object_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS login_bg_opacity numeric NOT NULL DEFAULT 0.2;
