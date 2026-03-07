
CREATE TABLE public.pm_pdf_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  background_color text NOT NULL DEFAULT '#0B0D12',
  background_image_url text,
  cover_logo_url text,
  title_font_size integer NOT NULL DEFAULT 32,
  title_color text NOT NULL DEFAULT '#FFFFFF',
  subtitle_font_size integer NOT NULL DEFAULT 18,
  subtitle_color text NOT NULL DEFAULT '#AAAAAA',
  card_proportion text NOT NULL DEFAULT 'square',
  card_font_size integer NOT NULL DEFAULT 14,
  card_date_font_size integer NOT NULL DEFAULT 12,
  card_caption_font_size integer NOT NULL DEFAULT 11,
  show_caption_on_card boolean NOT NULL DEFAULT true,
  show_time_on_card boolean NOT NULL DEFAULT true,
  accent_color text NOT NULL DEFAULT '#7C5CFF',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.pm_pdf_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_pdf_settings_select_auth" ON public.pm_pdf_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_pdf_settings_select_anon" ON public.pm_pdf_settings FOR SELECT TO anon USING (true);
CREATE POLICY "pm_pdf_settings_admin_all" ON public.pm_pdf_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default settings row
INSERT INTO public.pm_pdf_settings (id) VALUES (gen_random_uuid());
