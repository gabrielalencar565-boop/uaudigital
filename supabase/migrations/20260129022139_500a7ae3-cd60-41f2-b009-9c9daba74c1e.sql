-- App settings (singleton) for branding assets like sidebar logo
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  logo_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Ensure singleton row semantics
INSERT INTO public.app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can read app settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'App settings are readable by authenticated users'
  ) THEN
    CREATE POLICY "App settings are readable by authenticated users"
    ON public.app_settings
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Only admins can update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'Admins can update app settings'
  ) THEN
    CREATE POLICY "Admins can update app settings"
    ON public.app_settings
    FOR UPDATE
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Only admins can insert (not expected, but safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'Admins can insert app settings'
  ) THEN
    CREATE POLICY "Admins can insert app settings"
    ON public.app_settings
    FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Storage bucket for app assets (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read app assets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'App assets are publicly readable'
  ) THEN
    CREATE POLICY "App assets are publicly readable"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'app-assets');
  END IF;
END $$;

-- Only admins can upload app assets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can upload app assets'
  ) THEN
    CREATE POLICY "Admins can upload app assets"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'app-assets'
      AND public.has_role(auth.uid(), 'admin')
    );
  END IF;
END $$;

-- Only admins can update app assets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can update app assets'
  ) THEN
    CREATE POLICY "Admins can update app assets"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'app-assets'
      AND public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
      bucket_id = 'app-assets'
      AND public.has_role(auth.uid(), 'admin')
    );
  END IF;
END $$;

-- Only admins can delete app assets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can delete app assets'
  ) THEN
    CREATE POLICY "Admins can delete app assets"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'app-assets'
      AND public.has_role(auth.uid(), 'admin')
    );
  END IF;
END $$;

-- Keep updated_at fresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_app_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
