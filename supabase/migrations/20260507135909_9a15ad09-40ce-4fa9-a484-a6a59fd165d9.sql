
-- Fix existing periodic snapshots: set point_value to configured base_points (no extra multiplier)
UPDATE public.tasks t
SET point_value = sc.base_points,
    late_penalty_value = sc.late_penalty,
    updated_at = now()
FROM public.scoring_config sc
WHERE t.description LIKE 'pm:%:custom_%'
  AND t.deleted_at IS NULL
  AND t.status = 'concluido'
  AND sc.stage = split_part(t.description, ':', 3);

-- Recalculate performance_scores for affected users
DO $$
DECLARE
  v_user uuid;
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_month int := EXTRACT(MONTH FROM CURRENT_DATE)::int;
BEGIN
  FOR v_user IN
    SELECT DISTINCT t.assigned_user_id
    FROM public.tasks t
    WHERE t.description LIKE 'pm:%:custom_%'
      AND t.deleted_at IS NULL
      AND t.status = 'concluido'
      AND t.due_date >= (date_trunc('month', CURRENT_DATE))::date
      AND t.due_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
  LOOP
    PERFORM public.recompute_metas_prazos(v_user, v_year, v_month);
  END LOOP;
END;
$$;
