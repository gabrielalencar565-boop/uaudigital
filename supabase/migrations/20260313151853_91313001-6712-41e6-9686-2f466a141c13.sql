
CREATE TABLE public.internal_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  day_of_month integer NOT NULL DEFAULT 1,
  is_recurring boolean NOT NULL DEFAULT true,
  specific_date date NULL,
  icon text NOT NULL DEFAULT 'calendar',
  color text NOT NULL DEFAULT '#7C5CFF',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.internal_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_dates_select_auth" ON public.internal_dates
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "internal_dates_admin_all" ON public.internal_dates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
