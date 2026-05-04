
CREATE OR REPLACE FUNCTION public.pm_sync_stage_completion(
  _pm_task_id uuid,
  _completed_stage text,
  _user_id uuid DEFAULT NULL
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
  v_existing_task_id uuid;
  v_new_task_id uuid;
  v_is_freelancer boolean;
  v_assignee_id uuid;
  v_watchers uuid[];
  v_watcher uuid;
  v_is_extra boolean;
  v_child_rec RECORD;
  v_child_count int;
  v_all_users uuid[] := ARRAY[]::uuid[];
  v_user uuid;
  v_desc_key text;
  v_all_assignees uuid[];
  v_current_assignee uuid;
  v_force_parent_assignee boolean;
  v_watcher_qty int;
  -- NEW: periodic stage scoring overrides
  v_periodic_key text;
  v_periodic_base numeric;
  v_periodic_penalty numeric;
BEGIN
  SELECT client_id, due_date, title, parent_task_id, assignee_id, watchers, is_extra_demand, periodic_stage_key
  INTO v_client_id, v_due_date, v_title, v_parent_task_id, v_assignee_id, v_watchers, v_is_extra, v_periodic_key
  FROM public.pm_tasks
  WHERE id = _pm_task_id;

  IF v_client_id IS NULL THEN RETURN; END IF;
  IF v_parent_task_id IS NOT NULL THEN RETURN; END IF;
  IF v_due_date IS NULL THEN v_due_date := CURRENT_DATE; END IF;

  -- If periodic_stage_key is set, look up its scoring config for point overrides
  v_periodic_base := NULL;
  v_periodic_penalty := NULL;
  IF v_periodic_key IS NOT NULL THEN
    SELECT sc.base_points, sc.late_penalty
    INTO v_periodic_base, v_periodic_penalty
    FROM public.scoring_config sc
    WHERE sc.stage = v_periodic_key
    LIMIT 1;
  END IF;

  SELECT is_freelancer_sentinel INTO v_is_freelancer
  FROM public.clients WHERE id = v_client_id;
  IF v_is_freelancer = true THEN RETURN; END IF;

  BEGIN
    v_stage_type := _completed_stage::public.stage_type;
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  IF _user_id IS NULL THEN _user_id := v_assignee_id; END IF;
  IF _user_id IS NULL THEN RETURN; END IF;

  v_force_parent_assignee := (_completed_stage IN ('pdf','agendamento'));

  -- Magic Number sync
  IF COALESCE(v_is_extra, false) = false THEN
    BEGIN
      v_magic2_stage := _completed_stage::public.magic2_stage_type;
      SELECT l.magic2_client_id INTO v_magic2_client_id
      FROM public.magic2_client_links l WHERE l.agenda_client_id = v_client_id LIMIT 1;
      IF v_magic2_client_id IS NOT NULL THEN
        SELECT id INTO v_cycle_id
        FROM public.magic2_cycles
        WHERE client_id = v_magic2_client_id AND year = v_year AND month = v_month LIMIT 1;
        IF v_cycle_id IS NOT NULL THEN
          UPDATE public.magic2_cycle_stages
          SET completed = true, completed_at = now(), completed_by = _user_id, updated_at = now()
          WHERE cycle_id = v_cycle_id AND stage = v_magic2_stage AND completed = false;
        END IF;
      END IF;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;

  SELECT COUNT(*) INTO v_child_count
  FROM public.pm_tasks
  WHERE parent_task_id = _pm_task_id
    AND deleted_at IS NULL;

  IF v_child_count > 0 AND NOT v_force_parent_assignee THEN
    -- Per-subtask-assignee distribution
    FOR v_child_rec IN
      SELECT
        COALESCE(sub.assignee_id, v_assignee_id, _user_id) AS effective_assignee,
        COUNT(*)::int AS qty
      FROM public.pm_tasks sub
      WHERE sub.parent_task_id = _pm_task_id
        AND sub.deleted_at IS NULL
      GROUP BY COALESCE(sub.assignee_id, v_assignee_id, _user_id)
    LOOP
      v_desc_key := 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':' || v_child_rec.effective_assignee::text;

      SELECT id INTO v_existing_task_id
      FROM public.tasks
      WHERE description = v_desc_key AND deleted_at IS NULL
      LIMIT 1;

      IF v_existing_task_id IS NULL THEN
        INSERT INTO public.tasks (
          client_id, stage, assigned_user_id, due_date, created_by,
          status, quantity, title, description, completed_at, is_extra_demand,
          point_value, late_penalty_value
        ) VALUES (
          v_client_id, v_stage_type, v_child_rec.effective_assignee, v_due_date, _user_id,
          'concluido'::public.task_status, v_child_rec.qty,
          v_title, v_desc_key, now(), COALESCE(v_is_extra, false),
          v_periodic_base, v_periodic_penalty
        )
        RETURNING id INTO v_new_task_id;
      ELSE
        v_new_task_id := v_existing_task_id;
        UPDATE public.tasks
        SET status = 'concluido'::public.task_status,
            completed_at = now(),
            quantity = v_child_rec.qty,
            is_extra_demand = COALESCE(v_is_extra, false),
            assigned_user_id = v_child_rec.effective_assignee,
            point_value = v_periodic_base,
            late_penalty_value = v_periodic_penalty,
            updated_at = now()
        WHERE id = v_existing_task_id;
      END IF;

      DELETE FROM public.tasks
      WHERE description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
        AND deleted_at IS NULL;

      IF NOT v_child_rec.effective_assignee = ANY(v_all_users) THEN
        v_all_users := v_all_users || v_child_rec.effective_assignee;
      END IF;
    END LOOP;

    -- Score watchers of the parent task too.
    IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
      v_watcher_qty := GREATEST(1, v_child_count);
      FOREACH v_watcher IN ARRAY v_watchers
      LOOP
        IF v_watcher IS NULL THEN CONTINUE; END IF;
        IF v_watcher = ANY(v_all_users) THEN CONTINUE; END IF;

        v_desc_key := 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':' || v_watcher::text;

        SELECT id INTO v_existing_task_id
        FROM public.tasks
        WHERE description = v_desc_key AND deleted_at IS NULL
        LIMIT 1;

        IF v_existing_task_id IS NULL THEN
          INSERT INTO public.tasks (
            client_id, stage, assigned_user_id, due_date, created_by,
            status, quantity, title, description, completed_at, is_extra_demand,
            point_value, late_penalty_value
          ) VALUES (
            v_client_id, v_stage_type, v_watcher, v_due_date, _user_id,
            'concluido'::public.task_status, v_watcher_qty,
            v_title, v_desc_key, now(), COALESCE(v_is_extra, false),
            v_periodic_base, v_periodic_penalty
          );
        ELSE
          UPDATE public.tasks
          SET status = 'concluido'::public.task_status,
              completed_at = now(),
              quantity = v_watcher_qty,
              is_extra_demand = COALESCE(v_is_extra, false),
              assigned_user_id = v_watcher,
              point_value = v_periodic_base,
              late_penalty_value = v_periodic_penalty,
              updated_at = now()
          WHERE id = v_existing_task_id;
        END IF;

        v_all_users := v_all_users || v_watcher;
      END LOOP;
    END IF;

  ELSE
    -- NO subtasks OR force-parent (PDF/Agendamento): score parent assignee + watchers
    v_all_assignees := ARRAY[]::uuid[];
    IF v_assignee_id IS NOT NULL THEN
      v_all_assignees := v_all_assignees || v_assignee_id;
    END IF;
    IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
      FOREACH v_watcher IN ARRAY v_watchers
      LOOP
        IF NOT v_watcher = ANY(v_all_assignees) THEN
          v_all_assignees := v_all_assignees || v_watcher;
        END IF;
      END LOOP;
    END IF;
    IF array_length(v_all_assignees, 1) IS NULL OR array_length(v_all_assignees, 1) = 0 THEN
      v_all_assignees := ARRAY[_user_id];
    END IF;

    IF v_force_parent_assignee THEN
      DELETE FROM public.tasks
      WHERE description LIKE 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':%'
        AND assigned_user_id <> ALL(v_all_assignees)
        AND deleted_at IS NULL;
    END IF;

    DELETE FROM public.tasks
    WHERE description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
      AND deleted_at IS NULL;

    DECLARE
      v_qty_per_user int;
    BEGIN
      IF v_force_parent_assignee AND v_child_count > 0 THEN
        v_qty_per_user := GREATEST(1, v_child_count / GREATEST(1, array_length(v_all_assignees, 1)));
      ELSE
        v_qty_per_user := 1;
      END IF;

      FOREACH v_current_assignee IN ARRAY v_all_assignees
      LOOP
        v_desc_key := 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':' || v_current_assignee::text;

        SELECT id INTO v_existing_task_id
        FROM public.tasks
        WHERE description = v_desc_key AND deleted_at IS NULL
        LIMIT 1;

        IF v_existing_task_id IS NULL THEN
          INSERT INTO public.tasks (
            client_id, stage, assigned_user_id, due_date, created_by,
            status, quantity, title, description, completed_at, is_extra_demand,
            point_value, late_penalty_value
          ) VALUES (
            v_client_id, v_stage_type, v_current_assignee, v_due_date, _user_id,
            'concluido'::public.task_status, v_qty_per_user,
            v_title, v_desc_key, now(), COALESCE(v_is_extra, false),
            v_periodic_base, v_periodic_penalty
          );
        ELSE
          UPDATE public.tasks
          SET status = 'concluido'::public.task_status,
              completed_at = now(),
              quantity = v_qty_per_user,
              is_extra_demand = COALESCE(v_is_extra, false),
              assigned_user_id = v_current_assignee,
              point_value = v_periodic_base,
              late_penalty_value = v_periodic_penalty,
              updated_at = now()
          WHERE id = v_existing_task_id;
        END IF;

        IF NOT v_current_assignee = ANY(v_all_users) THEN
          v_all_users := v_all_users || v_current_assignee;
        END IF;
      END LOOP;
    END;
  END IF;

  IF v_assignee_id IS NOT NULL AND NOT v_assignee_id = ANY(v_all_users) THEN
    v_all_users := v_all_users || v_assignee_id;
  END IF;
  IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
    FOREACH v_watcher IN ARRAY v_watchers
    LOOP
      IF NOT v_watcher = ANY(v_all_users) THEN
        v_all_users := v_all_users || v_watcher;
      END IF;
    END LOOP;
  END IF;

  PERFORM public.pm_recalc_tag_points(_pm_task_id);

  FOREACH v_user IN ARRAY v_all_users
  LOOP
    PERFORM public.recompute_metas_prazos(v_user, v_year, v_month);
  END LOOP;
END;
$$;
