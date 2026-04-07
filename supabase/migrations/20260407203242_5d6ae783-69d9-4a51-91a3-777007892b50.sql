
-- ══════════════════════════════════════════════════════════════
-- 1) Rewrite pm_sync_stage_completion to create per-assignee scoring tasks
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.pm_sync_stage_completion(
  _pm_task_id uuid,
  _completed_stage text,
  _user_id uuid DEFAULT NULL,
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
BEGIN
  -- Get pm_task info
  SELECT client_id, due_date, title, parent_task_id, assignee_id, watchers, is_extra_demand
  INTO v_client_id, v_due_date, v_title, v_parent_task_id, v_assignee_id, v_watchers, v_is_extra
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

  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  IF _user_id IS NULL THEN _user_id := v_assignee_id; END IF;
  IF _user_id IS NULL THEN RETURN; END IF;

  -- ═══ MAGIC NUMBER SYNC (unchanged) ═══
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

  -- ═══ PERFORMANCE SYNC — per-subtask-assignee distribution ═══
  
  -- Check if there are child tasks with assignees
  SELECT COUNT(*) INTO v_child_count
  FROM public.pm_tasks
  WHERE parent_task_id = _pm_task_id;

  IF v_child_count > 0 THEN
    -- Group children by assignee and create separate scoring tasks
    FOR v_child_rec IN
      SELECT
        COALESCE(sub.assignee_id, v_assignee_id, _user_id) AS effective_assignee,
        COUNT(*)::int AS qty
      FROM public.pm_tasks sub
      WHERE sub.parent_task_id = _pm_task_id
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
          status, quantity, title, description, completed_at, is_extra_demand
        ) VALUES (
          v_client_id, v_stage_type, v_child_rec.effective_assignee, v_due_date, _user_id,
          'concluido'::public.task_status, v_child_rec.qty,
          v_title,
          v_desc_key,
          now(),
          COALESCE(v_is_extra, false)
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
            updated_at = now()
        WHERE id = v_existing_task_id;
      END IF;

      -- Add watchers of parent task to each scoring task
      IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
        FOREACH v_watcher IN ARRAY v_watchers
        LOOP
          IF v_watcher <> v_child_rec.effective_assignee THEN
            INSERT INTO public.task_assignees (task_id, user_id, added_by)
            VALUES (v_new_task_id, v_watcher, _user_id)
            ON CONFLICT DO NOTHING;
          END IF;
        END LOOP;
      END IF;

      -- Track user for recompute
      IF NOT v_child_rec.effective_assignee = ANY(v_all_users) THEN
        v_all_users := v_all_users || v_child_rec.effective_assignee;
      END IF;
    END LOOP;

    -- Delete old-format scoring task if it exists (migration from old to new format)
    DELETE FROM public.tasks
    WHERE description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
      AND deleted_at IS NULL;

  ELSE
    -- No children: single scoring task (old behavior)
    v_desc_key := 'pm:' || _pm_task_id::text || ':' || _completed_stage;

    SELECT id INTO v_existing_task_id
    FROM public.tasks
    WHERE description = v_desc_key AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_task_id IS NULL THEN
      INSERT INTO public.tasks (
        client_id, stage, assigned_user_id, due_date, created_by,
        status, quantity, title, description, completed_at, is_extra_demand
      ) VALUES (
        v_client_id, v_stage_type, _user_id, v_due_date, _user_id,
        'concluido'::public.task_status, 1,
        v_title,
        v_desc_key,
        now(),
        COALESCE(v_is_extra, false)
      )
      RETURNING id INTO v_new_task_id;
    ELSE
      v_new_task_id := v_existing_task_id;
      UPDATE public.tasks
      SET status = 'concluido'::public.task_status,
          completed_at = now(),
          quantity = 1,
          is_extra_demand = COALESCE(v_is_extra, false),
          updated_at = now()
      WHERE id = v_existing_task_id;
    END IF;

    -- Add watchers
    IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
      FOREACH v_watcher IN ARRAY v_watchers
      LOOP
        IF v_watcher <> _user_id THEN
          INSERT INTO public.task_assignees (task_id, user_id, added_by)
          VALUES (v_new_task_id, v_watcher, _user_id)
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END IF;

    IF v_assignee_id IS NOT NULL AND v_assignee_id <> _user_id THEN
      INSERT INTO public.task_assignees (task_id, user_id, added_by)
      VALUES (v_new_task_id, v_assignee_id, _user_id)
      ON CONFLICT DO NOTHING;
    END IF;

    IF NOT _user_id = ANY(v_all_users) THEN
      v_all_users := v_all_users || _user_id;
    END IF;
  END IF;

  -- Add parent assignee + watchers to v_all_users for recompute
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

  -- Recompute metas_prazos for all involved users
  FOREACH v_user IN ARRAY v_all_users
  LOOP
    PERFORM public.recompute_metas_prazos(v_user, v_year, v_month);
  END LOOP;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 2) Rewrite pm_recalc_tag_points to handle per-assignee scoring
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.pm_recalc_tag_points(_pm_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tags text[];
  v_tag text;
  v_tag_points numeric := 0;
  v_tag_key text;
  v_tag_base numeric;
  v_is_extra boolean;
  v_snapshot RECORD;
  v_stage_base numeric;
  v_stage_uses_qty boolean;
  v_stage_extra_mult numeric;
  v_quantity int;
  v_total_points numeric;
  v_due_date date;
  v_year int;
  v_month int;
  v_affected_users uuid[] := ARRAY[]::uuid[];
  v_desc_parts text[];
  v_scoring_assignee uuid;
  v_parent_assignee uuid;
BEGIN
  -- Get task info
  SELECT tags, is_extra_demand, due_date, assignee_id
  INTO v_tags, v_is_extra, v_due_date, v_parent_assignee
  FROM public.pm_tasks
  WHERE id = _pm_task_id;

  IF v_due_date IS NULL THEN v_due_date := CURRENT_DATE; END IF;
  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  -- For each scoring task row
  FOR v_snapshot IN
    SELECT t.id, t.stage::text as stage_text, t.assigned_user_id, t.description, t.quantity
    FROM public.tasks t
    WHERE t.description LIKE 'pm:' || _pm_task_id::text || ':%'
      AND t.deleted_at IS NULL
      AND t.status = 'concluido'
  LOOP
    -- Parse description to check format: pm:{id}:{stage} or pm:{id}:{stage}:{assignee}
    v_desc_parts := string_to_array(v_snapshot.description, ':');
    
    IF array_length(v_desc_parts, 1) >= 4 THEN
      -- New per-assignee format: calculate tags only from this assignee's subtasks
      v_scoring_assignee := v_desc_parts[4]::uuid;
      
      SELECT array_agg(DISTINCT t_tag)
      INTO v_tags
      FROM public.pm_tasks sub, unnest(sub.tags) AS t_tag
      WHERE sub.parent_task_id = _pm_task_id
        AND COALESCE(sub.assignee_id, v_parent_assignee) = v_scoring_assignee
        AND sub.tags IS NOT NULL
        AND array_length(sub.tags, 1) > 0;
    ELSE
      -- Old format: use parent tags or aggregate all subtask tags
      SELECT tags INTO v_tags FROM public.pm_tasks WHERE id = _pm_task_id;
      IF v_tags IS NULL OR array_length(v_tags, 1) IS NULL THEN
        SELECT array_agg(DISTINCT t_tag)
        INTO v_tags
        FROM public.pm_tasks sub, unnest(sub.tags) AS t_tag
        WHERE sub.parent_task_id = _pm_task_id
          AND sub.tags IS NOT NULL
          AND array_length(sub.tags, 1) > 0;
      END IF;
    END IF;

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

    -- Get stage scoring config
    SELECT base_points, uses_quantity, extra_demand_multiplier
    INTO v_stage_base, v_stage_uses_qty, v_stage_extra_mult
    FROM public.scoring_config
    WHERE stage = v_snapshot.stage_text
    LIMIT 1;

    IF v_stage_base IS NULL THEN v_stage_base := 1; END IF;
    IF v_stage_uses_qty IS NULL THEN v_stage_uses_qty := false; END IF;
    IF v_stage_extra_mult IS NULL THEN v_stage_extra_mult := 1.5; END IF;

    v_quantity := COALESCE(v_snapshot.quantity, 1);

    v_total_points := (v_stage_base + v_tag_points)
      * CASE WHEN v_stage_uses_qty THEN v_quantity ELSE 1 END
      * CASE WHEN v_is_extra AND v_stage_uses_qty THEN v_stage_extra_mult ELSE 1 END;

    UPDATE public.tasks
    SET point_value = v_total_points, updated_at = now()
    WHERE id = v_snapshot.id;

    IF NOT v_snapshot.assigned_user_id = ANY(v_affected_users) THEN
      v_affected_users := v_affected_users || v_snapshot.assigned_user_id;
    END IF;
  END LOOP;

  -- Recompute scores for affected users
  DECLARE
    v_user uuid;
  BEGIN
    FOREACH v_user IN ARRAY v_affected_users
    LOOP
      PERFORM public.recompute_all_scores(v_user, v_year, v_month);
    END LOOP;
  END;
END;
$$;
