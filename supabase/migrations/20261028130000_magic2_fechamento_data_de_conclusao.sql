-- O fechamento guarda também o dia em que o mês realmente chegou a 100% (pode ser antes do dia em que alguém clicou
-- em "Fechar ciclo"). O selo "no prazo / com atraso" usa essa data quando o ciclo está fechado.
ALTER TABLE public.magic2_month_closures ADD COLUMN IF NOT EXISTS concluded_at timestamptz;
UPDATE public.magic2_month_closures SET concluded_at = closed_at WHERE concluded_at IS NULL;

CREATE POLICY magic2_month_closures_update_admin ON public.magic2_month_closures
  FOR UPDATE USING (public.has_role((SELECT auth.uid()), 'admin'::app_role) AND agency_id = (SELECT public.current_agency_id()))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role) AND agency_id = (SELECT public.current_agency_id()));
