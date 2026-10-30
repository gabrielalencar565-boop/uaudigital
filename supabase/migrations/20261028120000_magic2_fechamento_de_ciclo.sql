-- Fechamento do ciclo mensal do Magic Number: guarda o resultado do mês (ex.: 126/126 = 100%) e,
-- depois de fechado, ninguém desmarca etapas daquele mês até um administrador reabrir.
CREATE TABLE IF NOT EXISTS public.magic2_month_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL DEFAULT public.current_agency_id(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  total_stages integer NOT NULL,
  done_stages integer NOT NULL,
  pct integer NOT NULL,
  UNIQUE (agency_id, year, month)
);

ALTER TABLE public.magic2_month_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY magic2_month_closures_select ON public.magic2_month_closures
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL AND agency_id = (SELECT public.current_agency_id()));

CREATE POLICY magic2_month_closures_insert_admin ON public.magic2_month_closures
  FOR INSERT WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role) AND agency_id = (SELECT public.current_agency_id()));

CREATE POLICY magic2_month_closures_delete_admin ON public.magic2_month_closures
  FOR DELETE USING (public.has_role((SELECT auth.uid()), 'admin'::app_role) AND agency_id = (SELECT public.current_agency_id()));

-- Mês fechado: não deixa desmarcar etapa (marcar continua permitido)
CREATE OR REPLACE FUNCTION public.magic2_block_uncheck_closed_month()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.completed IS TRUE AND NEW.completed IS NOT TRUE AND EXISTS (
    SELECT 1
    FROM public.magic2_cycles c
    JOIN public.magic2_month_closures m
      ON m.agency_id = c.agency_id AND m.year = c.year AND m.month = c.month
    WHERE c.id = NEW.cycle_id
  ) THEN
    RAISE EXCEPTION 'Ciclo fechado: reabra o mês para desmarcar etapas.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS magic2_block_uncheck_closed_month ON public.magic2_cycle_stages;
CREATE TRIGGER magic2_block_uncheck_closed_month
  BEFORE UPDATE OF completed ON public.magic2_cycle_stages
  FOR EACH ROW EXECUTE FUNCTION public.magic2_block_uncheck_closed_month();
