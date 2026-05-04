
-- Fix existing tasks from periodic stage pm_tasks that have wrong point_value
DO $$
DECLARE
  v_rec RECORD;
  v_pm_id uuid;
  v_periodic_key text;
  v_base numeric;
  v_penalty numeric;
BEGIN
  FOR v_rec IN
    SELECT t.id, t.description, t.assigned_user_id, t.due_date
    FROM public.tasks t
    WHERE t.deleted_at IS NULL
      AND t.status = 'concluido'
      AND t.description LIKE 'pm:%'
  LOOP
    BEGIN
      v_pm_id := split_part(v_rec.description, ':', 2)::uuid;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;

    SELECT periodic_stage_key INTO v_periodic_key
    FROM public.pm_tasks
    WHERE id = v_pm_id;

    IF v_periodic_key IS NOT NULL THEN
      SELECT sc.base_points, sc.late_penalty
      INTO v_base, v_penalty
      FROM public.scoring_config sc
      WHERE sc.stage = v_periodic_key
      LIMIT 1;

      IF v_base IS NOT NULL THEN
        UPDATE public.tasks
        SET point_value = v_base,
            late_penalty_value = v_penalty,
            updated_at = now()
        WHERE id = v_rec.id
          AND (point_value IS DISTINCT FROM v_base OR late_penalty_value IS DISTINCT FROM v_penalty);
      END IF;
    END IF;
  END LOOP;

  -- Recompute scores for affected users
  FOR v_rec IN
    SELECT DISTINCT t.assigned_user_id, EXTRACT(YEAR FROM t.due_date)::int AS yr, EXTRACT(MONTH FROM t.due_date)::int AS mo
    FROM public.tasks t
    JOIN public.pm_tasks p ON p.id = split_part(t.description, ':', 2)::uuid
    WHERE t.deleted_at IS NULL
      AND t.status = 'concluido'
      AND t.description LIKE 'pm:%'
      AND p.periodic_stage_key IS NOT NULL
  LOOP
    PERFORM public.recompute_metas_prazos(v_rec.assigned_user_id, v_rec.yr, v_rec.mo);
  END LOOP;
END;
$$;
