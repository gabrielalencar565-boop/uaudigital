
CREATE TABLE IF NOT EXISTS public.task_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_appeals_task_id ON public.task_appeals(task_id);
CREATE INDEX IF NOT EXISTS idx_task_appeals_user_id ON public.task_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_task_appeals_status ON public.task_appeals(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_appeals TO authenticated;
GRANT ALL ON public.task_appeals TO service_role;

ALTER TABLE public.task_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own appeals" ON public.task_appeals;
CREATE POLICY "Users insert own appeals" ON public.task_appeals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own appeals" ON public.task_appeals;
CREATE POLICY "Users view own appeals" ON public.task_appeals
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'planner'::app_role)
  );

DROP POLICY IF EXISTS "Admins manage appeals" ON public.task_appeals;
CREATE POLICY "Admins manage appeals" ON public.task_appeals
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'planner'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'planner'::app_role)
  );

DROP POLICY IF EXISTS "Admins delete appeals" ON public.task_appeals;
CREATE POLICY "Admins delete appeals" ON public.task_appeals
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_task_appeals_updated_at ON public.task_appeals;
CREATE TRIGGER update_task_appeals_updated_at
BEFORE UPDATE ON public.task_appeals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
          WHEN a.status IN ('pendente','aprovado') THEN 0
          ELSE -1
        END
      )
    ),
    0
  )::int
  INTO points
  FROM public.tasks t
  LEFT JOIN public.task_deadline_overrides o ON o.task_id = t.id
  LEFT JOIN public.task_appeals a ON a.task_id = t.id
  WHERE t.assigned_user_id = _user_id
    AND t.status = 'concluido'
    AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp;

  INSERT INTO public.performance_scores (user_id, year, month, metas_prazos, created_by)
  VALUES (_user_id, _year, _month, points, _user_id)
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET metas_prazos = EXCLUDED.metas_prazos, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.task_appeals_sync_metas()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  task_rec record;
  y int;
  m int;
BEGIN
  SELECT t.assigned_user_id, t.due_date
  INTO task_rec
  FROM public.tasks t
  WHERE t.id = COALESCE(NEW.task_id, OLD.task_id);

  IF task_rec.assigned_user_id IS NULL OR task_rec.due_date IS NULL THEN
    RETURN NULL;
  END IF;

  y := EXTRACT(YEAR FROM task_rec.due_date)::int;
  m := EXTRACT(MONTH FROM task_rec.due_date)::int;
  PERFORM public.recompute_metas_prazos(task_rec.assigned_user_id, y, m);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS task_appeals_sync_metas_trigger ON public.task_appeals;
CREATE TRIGGER task_appeals_sync_metas_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.task_appeals
FOR EACH ROW EXECUTE FUNCTION public.task_appeals_sync_metas();
