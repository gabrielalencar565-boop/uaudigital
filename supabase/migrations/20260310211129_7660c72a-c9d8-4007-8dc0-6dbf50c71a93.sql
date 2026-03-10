
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS login_bg_position_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS login_bg_position_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS login_bg_zoom numeric NOT NULL DEFAULT 1;
