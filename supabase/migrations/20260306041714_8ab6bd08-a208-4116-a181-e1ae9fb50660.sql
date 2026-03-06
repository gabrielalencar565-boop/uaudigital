
CREATE TABLE public.pm_stage_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  flow_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_stage_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_stage_flows_select_auth" ON public.pm_stage_flows
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "pm_stage_flows_admin_all" ON public.pm_stage_flows
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default flow
INSERT INTO public.pm_stage_flows (name, is_default, created_by, flow_config)
VALUES (
  'Fluxo Padrão',
  true,
  '00000000-0000-0000-0000-000000000000',
  '{"captacao":"planejamento","planejamento":"design","design":"edicao_videos","edicao_videos":"revisao","revisao":"pdf","pdf":"agendamento","agendamento":"entrega"}'::jsonb
);
