-- Tabela de exceções do admin para Metas/Prazos por tarefa
-- A ideia é manter o cálculo automático (+1 no prazo, -1 atrasada),
-- mas permitir que o admin sobrescreva o valor de uma tarefa específica.

CREATE TABLE IF NOT EXISTS public.task_deadline_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE,
  override_points integer NOT NULL,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para joins por task_id
CREATE INDEX IF NOT EXISTS idx_task_deadline_overrides_task_id ON public.task_deadline_overrides (task_id);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS update_task_deadline_overrides_updated_at ON public.task_deadline_overrides;
CREATE TRIGGER update_task_deadline_overrides_updated_at
BEFORE UPDATE ON public.task_deadline_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.task_deadline_overrides ENABLE ROW LEVEL SECURITY;

-- Somente admins podem ver/gerenciar
DROP POLICY IF EXISTS "Admins manage task deadline overrides" ON public.task_deadline_overrides;
CREATE POLICY "Admins manage task deadline overrides"
ON public.task_deadline_overrides
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Atualiza função de recompute para considerar overrides por tarefa
CREATE OR REPLACE FUNCTION public.recompute_metas_prazos(_user_id uuid, _year integer, _month integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  points int;
BEGIN
  SELECT COALESCE(
    SUM(
      COALESCE(o.override_points,
        CASE
          WHEN t.completed_at IS NULL THEN 0
          WHEN (t.completed_at::date <= t.due_date) THEN 1
          ELSE -1
        END
      )
    ),
    0
  )::int
  INTO points
  FROM public.tasks t
  LEFT JOIN public.task_deadline_overrides o
    ON o.task_id = t.id
  WHERE t.assigned_user_id = _user_id
    AND t.status = 'concluido'
    AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp;

  INSERT INTO public.performance_scores (
    user_id,
    year,
    month,
    metas_prazos,
    created_by
  ) VALUES (
    _user_id,
    _year,
    _month,
    points,
    _user_id
  )
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET metas_prazos = EXCLUDED.metas_prazos, updated_at = now();
END;
$$;

-- Trigger: quando o admin criar/editar/excluir uma exceção, recalcular metas/prazos
CREATE OR REPLACE FUNCTION public.task_deadline_overrides_sync_metas()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  task_rec record;
  y int;
  m int;
BEGIN
  -- Pega a tarefa relacionada (para saber user e mês do prazo)
  SELECT t.assigned_user_id, t.due_date
  INTO task_rec
  FROM public.tasks t
  WHERE t.id = COALESCE(NEW.task_id, OLD.task_id);

  IF task_rec.assigned_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  y := EXTRACT(YEAR FROM task_rec.due_date)::int;
  m := EXTRACT(MONTH FROM task_rec.due_date)::int;

  PERFORM public.recompute_metas_prazos(task_rec.assigned_user_id, y, m);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS task_deadline_overrides_sync_metas_trigger ON public.task_deadline_overrides;
CREATE TRIGGER task_deadline_overrides_sync_metas_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.task_deadline_overrides
FOR EACH ROW
EXECUTE FUNCTION public.task_deadline_overrides_sync_metas();
