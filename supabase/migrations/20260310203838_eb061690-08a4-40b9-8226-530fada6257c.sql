-- Allow anyone (including unauthenticated) to read app_settings for login page bg images
DROP POLICY IF EXISTS "App settings are readable by authenticated users" ON public.app_settings;
CREATE POLICY "App settings are readable by everyone"
  ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);