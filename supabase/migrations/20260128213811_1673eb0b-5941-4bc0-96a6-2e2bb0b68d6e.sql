-- Atualiza regra de Metas/Prazos: +1 tarefa concluída no prazo, -1 concluída atrasada.
-- Contabiliza no mês do due_date (prazo).

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
      CASE
        WHEN t.completed_at IS NULL THEN 0
        WHEN (t.completed_at::date <= t.due_date) THEN 1
        ELSE -1
      END
    ),
    0
  )::int
  INTO points
  FROM public.tasks t
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