
CREATE OR REPLACE FUNCTION public.pm_sync_stage_completion(
  _pm_task_id uuid,
  _completed_stage text,
  _user_id uuid,
  _scoring_user_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_legacy_task_id uuid;
  v_is_freelancer boolean;
  v_assignee_id uuid;
  v_watchers uuid[];
  v_is_extra boolean;
  v_point_value numeric;
  v_sc_base numeric;
  v_sc_penalty numeric;
  v_sc_uses_qty boolean;
  v_sc_extra_mult numeric;
  v_scoring_users uuid[];
  v_score_user uuid;
  v_actor_user uuid;
  v_tags text[];
  v_tag text;
  v_tag_points numeric;
  v_tag_key text;
  v_tag_base numeric;
BEGIN
  SELECT client_id, due_date, title, parent_task_id, assignee_id, watchers, is_extra_demand, tags
  INTO v_client_id, v_due_date, v_title, v_parent_task_id, v_assignee_id, v_watchers, v_is_extra, v_tags
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
  v_actor_user := COALESCE(_user_id, v_assignee_id);

  -- Resolve who should receive points
  IF _scoring_user_ids IS NOT NULL AND array_length(_scoring_user_ids, 1) > 0 THEN
    SELECT array_agg(DISTINCT u) INTO v_scoring_users
    FROM unnest(_scoring_user_ids) AS u
    WHERE u IS NOT NULL;
  ELSE
    SELECT array_agg(DISTINCT u) INTO v_scoring_users
    FROM unnest(
      COALESCE(ARRAY[v_assignee_id], ARRAY[]::uuid[]) ||
      COALESCE(v_watchers, ARRAY[]::uuid[]) ||
      COALESCE(ARRAY[_user_id], ARRAY[]::uuid[])
    ) AS u
    WHERE u IS NOT NULL;
  END IF;

  IF v_scoring_users IS NULL OR array_length(v_scoring_users, 1) = 0 THEN
    RETURN;
  END IF;

  IF v_actor_user IS NULL THEN
    v_actor_user := v_scoring_users[1];
  END IF;

  SELECT base_points, late_penalty, uses_quantity, extra_demand_multiplier
  INTO v_sc_base, v_sc_penalty, v_sc_uses_qty, v_sc_extra_mult
  FROM public.scoring_config
  WHERE stage = _completed_stage
  LIMIT 1;

  IF v_sc_base IS NULL THEN v_sc_base := 1; END IF;
  IF v_sc_penalty IS NULL THEN v_sc_penalty := -1; END IF;
  IF v_sc_uses_qty IS NULL THEN v_sc_uses_qty := false; END IF;
  IF v_sc_extra_mult IS NULL THEN v_sc_extra_mult := 1.5; END IF;

  -- Calculate tag points
  v_tag_points := 0;
  IF v_tags IS NOT NULL AND array_length(v_tags, 1) > 0 THEN
    FOREACH v_tag IN ARRAY v_tags
    LOOP
      v_tag_key := 'tag_' || lower(split_part(v_tag, ':', 1));
      SELECT base_points INTO v_tag_base
      FROM public.scoring_config
      WHERE stage = v_tag_key
      LIMIT 1;
      IF v_tag_base IS NOT NULL THEN
        v_tag_points := v_tag_points + v_tag_base;
      END IF;
    END LOOP;
  END IF;

  v_point_value := (v_sc_base + v_tag_points)
    * CASE WHEN v_sc_uses_qty THEN COALESCE(v_quantity, 1) ELSE 1 END
    * CASE WHEN v_is_extra AND v_sc_uses_qty THEN v_sc_extra_mult ELSE 1 END;

  -- Magic sync
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
              completed_by = v_actor_user,
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

  -- Create/update one scoring snapshot task per responsible user
  FOREACH v_score_user IN ARRAY v_scoring_users
  LOOP
    IF v_score_user IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_existing_task_id
    FROM public.tasks
    WHERE description = 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':' || v_score_user::text
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_task_id IS NULL THEN
      SELECT id INTO v_legacy_task_id
      FROM public.tasks
      WHERE description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
        AND deleted_at IS NULL
      LIMIT 1;

      IF v_legacy_task_id IS NOT NULL THEN
        v_existing_task_id := v_legacy_task_id;
      END IF;
    END IF;

    IF v_existing_task_id IS NULL THEN
      INSERT INTO public.tasks (
        client_id, stage, assigned_user_id, due_date, created_by,
        status, quantity, title, description, completed_at, is_extra_demand, point_value
      ) VALUES (
        v_client_id, v_stage_type, v_score_user, v_due_date, COALESCE(v_actor_user, v_score_user),
        'concluido'::public.task_status, v_quantity,
        v_title,
        'pm:' || _pm_task_id::text || ':' || _completed_stage || ':' || v_score_user::text,
        now(),
        COALESCE(v_is_extra, false),
        v_point_value
      );
    ELSE
      UPDATE public.tasks
      SET status = 'concluido'::public.task_status,
          completed_at = now(),
          quantity = v_quantity,
          is_extra_demand = COALESCE(v_is_extra, false),
          assigned_user_id = v_score_user,
          point_value = v_point_value,
          description = 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':' || v_score_user::text,
          updated_at = now()
      WHERE id = v_existing_task_id;
    END IF;

    PERFORM public.recompute_all_scores(v_score_user, v_year, v_month);
  END LOOP;
END;
$function$;
