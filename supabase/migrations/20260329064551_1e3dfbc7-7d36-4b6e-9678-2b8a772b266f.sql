CREATE OR REPLACE FUNCTION public.pm_sync_stage_completion(
  _pm_task_id uuid,
  _completed_stage text,
  _user_id uuid,
  _scoring_user_ids uuid[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_due_date date;
  v_title text;
  v_parent_task_id uuid;
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  v_year int;
  v_month int;
  v_stage_type public.stage_type;
  v_magic2_stage public.magic2_stage_type;
  v_quantity int;
  v_existing_task_id uuid;
  v_is_freelancer boolean;
  v_assignee_id uuid;
  v_is_extra boolean;
  v_point_value numeric;
  v_sc_base numeric;
  v_sc_penalty numeric;
  v_sc_uses_qty boolean;
  v_sc_extra_mult numeric;
BEGIN
  -- Get pm_task info
  SELECT client_id, due_date, title, parent_task_id, assignee_id, is_extra_demand
  INTO v_client_id, v_due_date, v_title, v_parent_task_id, v_assignee_id, v_is_extra
  FROM public.pm_tasks
  WHERE id = _pm_task_id;

  IF v_client_id IS NULL THEN RETURN; END IF;
  IF v_parent_task_id IS NOT NULL THEN RETURN; END IF;
  IF v_due_date IS NULL THEN v_due_date := CURRENT_DATE; END IF;

  SELECT is_freelancer_sentinel INTO v_is_freelancer
  FROM public.clients WHERE id = v_client_id;
  IF v_is_freelancer = true THEN RETURN; END IF;

  BEGIN
    v_stage_type := _completed_stage::public.stage_type;
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  SELECT GREATEST(COUNT(*)::int, 1) INTO v_quantity
  FROM public.pm_tasks
  WHERE parent_task_id = _pm_task_id;

  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  -- Use ONLY the current assignee for scoring (not watchers)
  IF v_assignee_id IS NULL THEN
    v_assignee_id := _user_id;
  END IF;
  IF v_assignee_id IS NULL THEN RETURN; END IF;

  -- ═══ CALCULATE POINT_VALUE SNAPSHOT ═══
  -- Lookup current scoring_config for this stage and snapshot the value
  SELECT base_points, late_penalty, uses_quantity, extra_demand_multiplier
  INTO v_sc_base, v_sc_penalty, v_sc_uses_qty, v_sc_extra_mult
  FROM public.scoring_config
  WHERE stage = _completed_stage
  LIMIT 1;

  -- Default fallback if no config found
  IF v_sc_base IS NULL THEN v_sc_base := 1; END IF;
  IF v_sc_penalty IS NULL THEN v_sc_penalty := -1; END IF;
  IF v_sc_uses_qty IS NULL THEN v_sc_uses_qty := false; END IF;
  IF v_sc_extra_mult IS NULL THEN v_sc_extra_mult := 1.5; END IF;

  -- Calculate the on-time point value (snapshot at completion time)
  v_point_value := v_sc_base
    * CASE WHEN v_sc_uses_qty THEN COALESCE(v_quantity, 1) ELSE 1 END
    * CASE WHEN v_is_extra AND v_sc_uses_qty THEN v_sc_extra_mult ELSE 1 END;

  -- ═══ MAGIC NUMBER SYNC (skip if extra demand) ═══
  IF NOT v_is_extra THEN
    BEGIN
      v_magic2_stage := _completed_stage::public.magic2_stage_type;

      SELECT l.magic2_client_id INTO v_magic2_client_id
      FROM public.magic2_client_links l
      WHERE l.agenda_client_id = v_client_id
      LIMIT 1;

      IF v_magic2_client_id IS NOT NULL THEN
        SELECT id INTO v_cycle_id
        FROM public.magic2_cycles
        WHERE client_id = v_magic2_client_id
          AND year = v_year AND month = v_month
        LIMIT 1;

        IF v_cycle_id IS NOT NULL THEN
          UPDATE public.magic2_cycle_stages
          SET completed = true,
              completed_at = now(),
              completed_by = v_assignee_id,
              updated_at = now()
          WHERE cycle_id = v_cycle_id
            AND stage = v_magic2_stage
            AND completed = false;
        END IF;
      END IF;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- ═══ PERFORMANCE SYNC — score ONLY the assignee ═══
  SELECT id INTO v_existing_task_id
  FROM public.tasks
  WHERE description = 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':' || v_assignee_id::text
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing_task_id IS NULL THEN
    SELECT id INTO v_existing_task_id
    FROM public.tasks
    WHERE description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_existing_task_id IS NULL THEN
    INSERT INTO public.tasks (
      client_id, stage, assigned_user_id, due_date, created_by,
      status, quantity, title, description, completed_at, is_extra_demand, point_value
    ) VALUES (
      v_client_id, v_stage_type, v_assignee_id, v_due_date, v_assignee_id,
      'concluido'::public.task_status, v_quantity,
      v_title,
      'pm:' || _pm_task_id::text || ':' || _completed_stage || ':' || v_assignee_id::text,
      now(),
      v_is_extra,
      v_point_value
    );
  ELSE
    UPDATE public.tasks
    SET status = 'concluido'::public.task_status,
        completed_at = now(),
        quantity = v_quantity,
        is_extra_demand = v_is_extra,
        assigned_user_id = v_assignee_id,
        point_value = v_point_value,
        updated_at = now()
    WHERE id = v_existing_task_id;
  END IF;

  PERFORM public.recompute_all_scores(v_assignee_id, v_year, v_month);
END;
$$;