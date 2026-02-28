
-- Table to store configurable scoring criteria
CREATE TABLE public.scoring_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage text NOT NULL UNIQUE,
  label text NOT NULL,
  base_points numeric NOT NULL DEFAULT 1,
  late_penalty numeric NOT NULL DEFAULT -1,
  uses_quantity boolean NOT NULL DEFAULT false,
  extra_demand_multiplier numeric NOT NULL DEFAULT 1.5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.scoring_config ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY scoring_config_admin_all ON public.scoring_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated can read
CREATE POLICY scoring_config_select_authenticated ON public.scoring_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Seed default values
INSERT INTO public.scoring_config (stage, label, base_points, late_penalty, uses_quantity, extra_demand_multiplier) VALUES
  ('planejamento', 'Planejamento', 4, -1, false, 1.5),
  ('pdf', 'PDF', 2, -1, false, 1.5),
  ('captacao', 'Captação', 1.5, -1, false, 1.5),
  ('edicao_videos', 'Vídeo', 1, -1, true, 1.5),
  ('design', 'Design', 1, -1, true, 1.5),
  ('revisao', 'Revisão', 1, -1, false, 1.5),
  ('entrega', 'Entrega', 1, -1, false, 1.5),
  ('alteracoes', 'Alterações', 1, -1, false, 1.5),
  ('agendamento', 'Agendamento', 1, -1, false, 1.5);

-- Update trigger
CREATE TRIGGER scoring_config_updated_at
  BEFORE UPDATE ON public.scoring_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
