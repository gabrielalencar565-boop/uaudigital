
CREATE OR REPLACE FUNCTION public.recompute_all_scores(_user_id uuid, _year integer, _month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  metas_prazos_pts numeric := 0;
  v_use_old boolean;
BEGIN
  IF _year < 2000 OR _year > 2100 OR _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid year or month';
  END IF;

  v_use_old := (_year < 2026 OR (_year = 2026 AND _month < 4));

  IF v_use_old THEN
    SELECT COALESCE(
      SUM(
        COALESCE(
          o.override_points::numeric,
          CASE
            WHEN t.completed_at IS NULL THEN 0
            WHEN t.stage::text IN ('pdf', 'agendamento') THEN 0
            WHEN ((t.completed_at AT TIME ZONE 'America/Sao_Paulo')::date <= t.due_date) THEN 1
            ELSE -1
          END
        )
      ),
      0
    )
    INTO metas_prazos_pts
    FROM public.tasks t
    LEFT JOIN public.task_deadline_overrides o ON o.task_id = t.id
    WHERE t.status = 'concluido'
      AND t.deleted_at IS NULL
      AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
      AND (
        t.assigned_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta 
          WHERE ta.task_id = t.id AND ta.user_id = _user_id
        )
      );
  ELSE
    SELECT COALESCE(
      SUM(
        COALESCE(
          o.override_points::numeric,
          CASE
            WHEN t.completed_at IS NULL THEN 0
            WHEN ((t.completed_at AT TIME ZONE 'America/Sao_Paulo')::date <= t.due_date) THEN
              CASE
                WHEN t.point_value IS NOT NULL THEN t.point_value
                ELSE
                  COALESCE(sc.base_points, 1) *
                  CASE WHEN COALESCE(sc.uses_quantity, false) THEN COALESCE(t.quantity, 1) ELSE 1 END *
                  CASE WHEN t.is_extra_demand AND COALESCE(sc.uses_quantity, false) THEN COALESCE(sc.extra_demand_multiplier, 1.5) ELSE 1 END
              END
            ELSE COALESCE(sc.late_penalty, -1)
          END
        )
      ),
      0
    )
    INTO metas_prazos_pts
    FROM public.tasks t
    LEFT JOIN public.task_deadline_overrides o ON o.task_id = t.id
    LEFT JOIN public.scoring_config sc ON sc.stage = t.stage::text
    WHERE t.status = 'concluido'
      AND t.deleted_at IS NULL
      AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
      AND (
        t.assigned_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta 
          WHERE ta.task_id = t.id AND ta.user_id = _user_id
        )
      );
  END IF;

  INSERT INTO public.performance_scores (
    user_id, year, month,
    metas_prazos, aprendizado_continuo, padrao_qualidade_uau,
    ambiente_organizado, comprometimento, created_by
  ) VALUES (
    _user_id, _year, _month,
    metas_prazos_pts, 0, 0, 0, 0, _user_id
  )
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET 
    metas_prazos = EXCLUDED.metas_prazos,
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.recompute_metas_prazos(_user_id uuid, _year integer, _month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  points numeric;
  v_use_old boolean;
BEGIN
  IF _year < 2000 OR _year > 2100 OR _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid year or month';
  END IF;

  v_use_old := (_year < 2026 OR (_year = 2026 AND _month < 4));

  IF v_use_old THEN
    SELECT COALESCE(
      SUM(
        COALESCE(
          o.override_points::numeric,
          CASE
            WHEN t.completed_at IS NULL THEN 0
            WHEN t.stage::text IN ('pdf', 'agendamento') THEN 0
            WHEN ((t.completed_at AT TIME ZONE 'America/Sao_Paulo')::date <= t.due_date) THEN 1
            ELSE -1
          END
        )
      ),
      0
    )
    INTO points
    FROM public.tasks t
    LEFT JOIN public.task_deadline_overrides o ON o.task_id = t.id
    WHERE t.status = 'concluido'
      AND t.deleted_at IS NULL
      AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
      AND (
        t.assigned_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = _user_id
        )
      );
  ELSE
    SELECT COALESCE(
      SUM(
        COALESCE(
          o.override_points::numeric,
          CASE
            WHEN t.completed_at IS NULL THEN 0
            WHEN ((t.completed_at AT TIME ZONE 'America/Sao_Paulo')::date <= t.due_date) THEN
              CASE
                WHEN t.point_value IS NOT NULL THEN t.point_value
                ELSE
                  COALESCE(sc.base_points, 1) *
                  CASE WHEN COALESCE(sc.uses_quantity, false) THEN COALESCE(t.quantity, 1) ELSE 1 END *
                  CASE WHEN t.is_extra_demand AND COALESCE(sc.uses_quantity, false) THEN COALESCE(sc.extra_demand_multiplier, 1.5) ELSE 1 END
              END
            ELSE COALESCE(sc.late_penalty, -1)
          END
        )
      ),
      0
    )
    INTO points
    FROM public.tasks t
    LEFT JOIN public.task_deadline_overrides o ON o.task_id = t.id
    LEFT JOIN public.scoring_config sc ON sc.stage = t.stage::text
    WHERE t.status = 'concluido'
      AND t.deleted_at IS NULL
      AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
      AND (
        t.assigned_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = _user_id
        )
      );
  END IF;

  INSERT INTO public.performance_scores (
    user_id, year, month, metas_prazos, created_by
  ) VALUES (
    _user_id, _year, _month, points, _user_id
  )
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET metas_prazos = EXCLUDED.metas_prazos, updated_at = now();
END;
$function$;
