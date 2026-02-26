
-- Categorias de limpeza (ex: passar pano, varrer)
CREATE TABLE public.cleaning_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cleaning_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cleaning_categories_admin_all" ON public.cleaning_categories
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cleaning_categories_select_authenticated" ON public.cleaning_categories
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Escala semanal de limpeza (dia da semana + usuário + categoria)
CREATE TABLE public.cleaning_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.cleaning_categories(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(day_of_week, user_id, category_id)
);

ALTER TABLE public.cleaning_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cleaning_schedules_admin_all" ON public.cleaning_schedules
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cleaning_schedules_select_authenticated" ON public.cleaning_schedules
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Conclusões de limpeza (registro diário)
CREATE TABLE public.cleaning_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id uuid NOT NULL REFERENCES public.cleaning_schedules(id) ON DELETE CASCADE,
  completed_date date NOT NULL,
  completed_by uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, completed_date)
);

ALTER TABLE public.cleaning_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cleaning_completions_admin_all" ON public.cleaning_completions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cleaning_completions_select_authenticated" ON public.cleaning_completions
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "cleaning_completions_insert_authenticated" ON public.cleaning_completions
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "cleaning_completions_delete_own" ON public.cleaning_completions
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (completed_by = auth.uid());
