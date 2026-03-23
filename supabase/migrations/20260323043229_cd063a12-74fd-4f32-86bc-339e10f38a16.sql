
CREATE OR REPLACE FUNCTION public.pm_sync_stage_completion(_pm_task_id uuid, _completed_stage text, _user_id uuid, _scoring_user_ids uuid[] DEFAULT NULL::uuid[])
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
  v_total_quantity int;
  v_existing_task_id uuid;
  v_is_freelancer boolean;
  v_is_extra boolean;
  v_all_users uuid[];
  v_uid uuid;
  v_child record;
  v_user_quantity int;
  v_tag_points numeric;
  v_tag_key text;
  v_tag_name text;
  v_child_tag record;
  v_sc_points numeric;
  v_sc_extra_multiplier numeric;
  v_use_tags boolean;
BEGIN
  SELECT client_id, due_date, title, parent_task_id, is_extra_demand
  INTO v_client_id, v_due_date, v_title, v_parent_task_id, v_is_extra
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

  SELECT GREATEST(COUNT(*)::int, 1) INTO v_total_quantity
  FROM public.pm_tasks
  WHERE parent_task_id = _pm_task_id;

  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  -- Tag-based scoring only from April 2026 onwards
  v_use_tags := (v_year > 2026 OR (v_year = 2026 AND v_month >= 4));

  -- Build user list from subtask assignees only
  v_all_users := ARRAY[]::uuid[];
  
  FOR v_child IN
    SELECT DISTINCT assignee_id
    FROM public.pm_tasks
    WHERE parent_task_id = _pm_task_id
      AND assignee_id IS NOT NULL
  LOOP
    IF NOT (v_child.assignee_id = ANY(v_all_users)) THEN
      v_all_users := array_append(v_all_users, v_child.assignee_id);
    END IF;
  END LOOP;

  IF array_length(v_all_users, 1) IS NULL THEN
    IF _scoring_user_ids IS NOT NULL AND array_length(_scoring_user_ids, 1) > 0 THEN
      v_all_users := _scoring_user_ids;
    ELSE
      v_all_users := ARRAY[_user_id];
    END IF;
  END IF;

  v_all_users := array_remove(v_all_users, NULL);
  IF array_length(v_all_users, 1) IS NULL THEN RETURN; END IF;

  -- MAGIC NUMBER SYNC (skip if extra demand)
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
              completed_by = v_all_users[1],
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

  -- PERFORMANCE SYNC
  FOREACH v_uid IN ARRAY v_all_users LOOP
    v_tag_points := 0;
    v_user_quantity := 0;
    
    -- Only calculate tag-based points from April 2026 onwards
    IF v_use_tags THEN
      FOR v_child_tag IN
        SELECT tags FROM public.pm_tasks
        WHERE parent_task_id = _pm_task_id
          AND assignee_id = v_uid
      LOOP
        v_user_quantity := v_user_quantity + 1;
        IF v_child_tag.tags IS NOT NULL AND array_length(v_child_tag.tags, 1) > 0 THEN
          FOREACH v_tag_name IN ARRAY v_child_tag.tags LOOP
            v_tag_key := 'tag_' || lower(regexp_replace(split_part(v_tag_name, ':', 1), ' ', '_', 'g'));
            SELECT base_points, extra_demand_multiplier
            INTO v_sc_points, v_sc_extra_multiplier
            FROM public.scoring_config
            WHERE stage = v_tag_key
            LIMIT 1;

            IF v_sc_points IS NOT NULL THEN
              v_tag_points := v_tag_points + (
                v_sc_points *
                CASE
                  WHEN v_is_extra THEN COALESCE(v_sc_extra_multiplier, 1.5)
                  ELSE 1
                END
              );
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;

    IF v_user_quantity = 0 THEN
      v_user_quantity := 1;
    END IF;

    SELECT id INTO v_existing_task_id
    FROM public.tasks
    WHERE description = 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':' || v_uid::text
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_task_id IS NULL THEN
      IF v_uid = v_all_users[1] THEN
        SELECT id INTO v_existing_task_id
        FROM public.tasks
        WHERE description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
          AND deleted_at IS NULL
        LIMIT 1;
      END IF;
    END IF;

    IF v_existing_task_id IS NULL THEN
      INSERT INTO public.tasks (
        client_id, stage, assigned_user_id, due_date, created_by,
        status, quantity, title, description, completed_at, is_extra_demand,
        point_value
      ) VALUES (
        v_client_id, v_stage_type, v_uid, v_due_date, v_uid,
        'concluido'::public.task_status, v_user_quantity,
        v_title,
        'pm:' || _pm_task_id::text || ':' || _completed_stage || ':' || v_uid::text,
        now(),
        v_is_extra,
        CASE WHEN v_use_tags AND v_tag_points > 0 THEN v_tag_points ELSE NULL END
      );
    ELSE
      UPDATE public.tasks
      SET status = 'concluido'::public.task_status,
          completed_at = now(),
          quantity = v_user_quantity,
          is_extra_demand = v_is_extra,
          assigned_user_id = v_uid,
          updated_at = now(),
          point_value = CASE WHEN v_use_tags AND v_tag_points > 0 THEN v_tag_points ELSE NULL END
      WHERE id = v_existing_task_id;
    END IF;

    PERFORM public.recompute_all_scores(v_uid, v_year, v_month);
  END LOOP;
END;
$function$;
