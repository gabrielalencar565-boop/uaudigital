-- Fix: add authorization + input validation to SECURITY DEFINER RPCs

CREATE OR REPLACE FUNCTION public.recompute_metas_prazos(_user_id uuid, _year integer, _month integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  points int;
BEGIN
  -- Authorization: only self or admin can recompute for a user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
  THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Input validation
  IF _year < 2000 OR _year > 2100 OR _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid year or month';
  END IF;

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


CREATE OR REPLACE FUNCTION public.magic2_seed_year(_year integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  m int;
BEGIN
  -- Authorization: admin only
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Input validation
  IF _year < 2000 OR _year > 2100 THEN
    RAISE EXCEPTION 'Invalid year';
  END IF;

  FOR r IN SELECT id FROM public.clients LOOP
    v_magic2_client_id := public.magic2_ensure_client_link(r.id);

    FOR m IN 1..12 LOOP
      SELECT id INTO v_cycle_id
      FROM public.magic2_cycles
      WHERE client_id = v_magic2_client_id
        AND year = _year
        AND month = m
      LIMIT 1;

      IF v_cycle_id IS NULL THEN
        INSERT INTO public.magic2_cycles (client_id, year, month, due_date, is_active)
        VALUES (v_magic2_client_id, _year, m, make_date(_year, m, 27), true)
        RETURNING id INTO v_cycle_id;

        INSERT INTO public.magic2_cycle_stages (cycle_id, stage, completed)
        SELECT v_cycle_id, unnest(enum_range(NULL::public.magic2_stage_type)), false;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;