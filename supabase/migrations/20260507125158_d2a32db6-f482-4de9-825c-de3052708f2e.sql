CREATE OR REPLACE FUNCTION public.pm_sync_stage_completion(
  _pm_task_id uuid,
  _completed_stage text,
  _user_id uuid DEFAULT NULL::uuid,
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
  v_existing_task_id uuid;
  v_assignee_id uuid;
  v_watchers uuid[];
  v_watcher uuid;
  v_is_extra boolean;
  v_child_rec RECORD;
  v_child_count int;
  v_all_users uuid[] := ARRAY[]::uuid[];
  v_user uuid;
  v_desc_key text;
  v_snapshot_stage_key text;
  v_all_assignees uuid[];
  v_force_parent_assignee boolean;
  v_watcher_qty int;
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

  v_snapshot_stage_key := COALESCE(v_periodic_key, _completed_stage);

  v_periodic_base := NULL;
  v_periodic_penalty := NULL;
  IF v_periodic_key IS NOT NULL THEN
    SELECT sc.base_points, sc.late_penalty
    INTO v_periodic_base, v_periodic_penalty
    FROM public.scoring_config sc
    WHERE sc.stage = v_periodic_key
    LIMIT 1;
  END IF;

  BEGIN
    v_stage_type := _completed_stage::public.stage_type;
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  IF _user_id IS NULL THEN _user_id := v_assignee_id; END IF;
  IF _user_id IS NULL THEN RETURN; END IF;

  -- PDF e Agendamento só forçam responsável da pai no fluxo padrão.
  -- Etapas periódicas (ex.: Reunião) devem pontuar responsável + watchers.
  v_force_parent_assignee := (_completed_stage IN ('pdf','agendamento') AND v_periodic_key IS NULL);

  IF COALESCE(v_is_extra, false) = false AND v_periodic_key IS NULL THEN
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
    FOR v_child_rec IN
      SELECT
        COALESCE(sub.assignee_id, v_assignee_id, _user_id) AS effective_assignee,
        COUNT(*)::int AS qty
      FROM public.pm_tasks sub
      WHERE sub.parent_task_id = _pm_task_id
        AND sub.deleted_at IS NULL
      GROUP BY COALESCE(sub.assignee_id, v_assignee_id, _user_id)
    LOOP
      v_desc_key := 'pm:' || _pm_task_id::text || ':' || v_snapshot_stage_key || ':' || v_child_rec.effective_assignee::text;

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
          'concluido', v_child_rec.qty, v_title, v_desc_key, now(), COALESCE(v_is_extra, false),
          v_periodic_base, v_periodic_penalty
        );
      ELSE
        UPDATE public.tasks
        SET status = 'concluido', completed_at = now(), quantity = v_child_rec.qty,
            point_value = COALESCE(v_periodic_base, point_value),
            late_penalty_value = COALESCE(v_periodic_penalty, late_penalty_value)
        WHERE id = v_existing_task_id;
      END IF;

      IF NOT v_child_rec.effective_assignee = ANY(v_all_users) THEN
        v_all_users := v_all_users || v_child_rec.effective_assignee;
      END IF;
    END LOOP;

    v_all_assignees := ARRAY(
      SELECT DISTINCT COALESCE(sub.assignee_id, v_assignee_id, _user_id)
      FROM public.pm_tasks sub
      WHERE sub.parent_task_id = _pm_task_id AND sub.deleted_at IS NULL
    );

    IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
      v_watcher_qty := v_child_count;
      FOREACH v_watcher IN ARRAY v_watchers LOOP
        IF v_watcher IS NULL THEN CONTINUE; END IF;
        IF v_watcher = ANY(v_all_assignees) THEN CONTINUE; END IF;

        v_desc_key := 'pm:' || _pm_task_id::text || ':' || v_snapshot_stage_key || ':' || v_watcher::text;

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
            'concluido', v_watcher_qty, v_title, v_desc_key, now(), COALESCE(v_is_extra, false),
            v_periodic_base, v_periodic_penalty
          );
        ELSE
          UPDATE public.tasks
          SET status = 'concluido', completed_at = now(), quantity = v_watcher_qty,
              point_value = COALESCE(v_periodic_base, point_value),
              late_penalty_value = COALESCE(v_periodic_penalty, late_penalty_value)
          WHERE id = v_existing_task_id;
        END IF;

        IF NOT v_watcher = ANY(v_all_users) THEN
          v_all_users := v_all_users || v_watcher;
        END IF;
      END LOOP;
    END IF;
  ELSE
    IF v_force_parent_assignee THEN
      v_all_users := ARRAY[COALESCE(v_assignee_id, _user_id)];
    ELSE
      IF _scoring_user_ids IS NOT NULL AND array_length(_scoring_user_ids, 1) > 0 THEN
        SELECT array_agg(DISTINCT u) INTO v_all_users
        FROM unnest(_scoring_user_ids) AS u
        WHERE u IS NOT NULL;
      ELSE
        v_all_users := ARRAY[_user_id];
        IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
          FOREACH v_watcher IN ARRAY v_watchers LOOP
            IF v_watcher IS NOT NULL AND NOT (v_watcher = ANY(v_all_users)) THEN
              v_all_users := v_all_users || v_watcher;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;

    FOREACH v_user IN ARRAY v_all_users LOOP
      v_desc_key := 'pm:' || _pm_task_id::text || ':' || v_snapshot_stage_key || ':' || v_user::text;

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
          v_client_id, v_stage_type, v_user, v_due_date, _user_id,
          'concluido', 1, v_title, v_desc_key, now(), COALESCE(v_is_extra, false),
          v_periodic_base, v_periodic_penalty
        );
      ELSE
        UPDATE public.tasks
        SET status = 'concluido', completed_at = now(),
            point_value = COALESCE(v_periodic_base, point_value),
            late_penalty_value = COALESCE(v_periodic_penalty, late_penalty_value)
        WHERE id = v_existing_task_id;
      END IF;
    END LOOP;
  END IF;

  PERFORM public.pm_recalc_tag_points(_pm_task_id);

  FOREACH v_user IN ARRAY v_all_users LOOP
    PERFORM public.recompute_metas_prazos(v_user, v_year, v_month);
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm_sync_stage_completion(
  _pm_task_id uuid,
  _completed_stage text,
  _user_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.pm_sync_stage_completion(_pm_task_id, _completed_stage, _user_id, NULL::uuid[]);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm_resync_correction(_pm_task_id uuid, _completed_stage text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_users uuid[];
  v_user uuid;
  v_due_date date;
  v_year int;
  v_month int;
  v_assignee_id uuid;
  v_periodic_key text;
  v_sync_stage text;
  v_new_users uuid[];
BEGIN
  SELECT due_date, assignee_id, periodic_stage_key, stage_current
  INTO v_due_date, v_assignee_id, v_periodic_key, v_sync_stage
  FROM public.pm_tasks
  WHERE id = _pm_task_id;

  IF v_due_date IS NULL THEN v_due_date := CURRENT_DATE; END IF;
  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  SELECT array_agg(DISTINCT assigned_user_id)
  INTO v_old_users
  FROM public.tasks
  WHERE (
    description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
    OR description LIKE 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':%'
    OR (v_periodic_key IS NOT NULL AND description = 'pm:' || _pm_task_id::text || ':' || v_periodic_key)
    OR (v_periodic_key IS NOT NULL AND description LIKE 'pm:' || _pm_task_id::text || ':' || v_periodic_key || ':%')
  )
  AND deleted_at IS NULL;

  DELETE FROM public.tasks
  WHERE (
    description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
    OR description LIKE 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':%'
    OR (v_periodic_key IS NOT NULL AND description = 'pm:' || _pm_task_id::text || ':' || v_periodic_key)
    OR (v_periodic_key IS NOT NULL AND description LIKE 'pm:' || _pm_task_id::text || ':' || v_periodic_key || ':%')
  )
  AND deleted_at IS NULL;

  PERFORM public.pm_sync_stage_completion(
    _pm_task_id,
    COALESCE(NULLIF(v_sync_stage, ''), _completed_stage),
    COALESCE(v_assignee_id, auth.uid()),
    NULL::uuid[]
  );

  SELECT array_agg(DISTINCT assigned_user_id)
  INTO v_new_users
  FROM public.tasks
  WHERE (
    description = 'pm:' || _pm_task_id::text || ':' || COALESCE(v_periodic_key, _completed_stage)
    OR description LIKE 'pm:' || _pm_task_id::text || ':' || COALESCE(v_periodic_key, _completed_stage) || ':%'
  )
  AND deleted_at IS NULL;

  IF v_old_users IS NOT NULL THEN
    FOREACH v_user IN ARRAY v_old_users
    LOOP
      PERFORM public.recompute_all_scores(v_user, v_year, v_month);
    END LOOP;
  END IF;

  IF v_new_users IS NOT NULL THEN
    FOREACH v_user IN ARRAY v_new_users
    LOOP
      IF v_old_users IS NULL OR NOT v_user = ANY(v_old_users) THEN
        PERFORM public.recompute_all_scores(v_user, v_year, v_month);
      END IF;
    END LOOP;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm_recalc_tag_points(_pm_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent_tags text[];
  v_is_extra boolean;
  v_due_date date;
  v_parent_assignee uuid;
  v_year int;
  v_month int;
  v_snapshot RECORD;
  v_stage_base numeric;
  v_stage_uses_qty boolean;
  v_stage_extra_mult numeric;
  v_stage_late_penalty numeric;
  v_total_points numeric;
  v_total_late_penalty numeric;
  v_affected_users uuid[] := ARRAY[]::uuid[];
  v_desc_parts text[];
  v_desc_stage_key text;
  v_scoring_stage_key text;
  v_scoring_assignee uuid;
  v_is_tag_only_stage boolean;
  v_child_rec RECORD;
  v_tag text;
  v_tag_key text;
  v_tag_base numeric;
  v_tag_late numeric;
  v_normalized text;
  v_child_tag_sum numeric;
  v_all_children_sum numeric;
  v_parent_late_sum numeric;
  v_unique_tag_keys text[];
  v_child_count int;
  v_tags_for_calc text[];
  v_user uuid;
BEGIN
  SELECT tags, is_extra_demand, due_date, assignee_id
  INTO v_parent_tags, v_is_extra, v_due_date, v_parent_assignee
  FROM public.pm_tasks
  WHERE id = _pm_task_id;

  IF v_due_date IS NULL THEN v_due_date := CURRENT_DATE; END IF;
  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  FOR v_snapshot IN
    SELECT t.id, t.stage::text as stage_text, t.assigned_user_id, t.description, t.quantity
    FROM public.tasks t
    WHERE t.description LIKE 'pm:' || _pm_task_id::text || ':%'
      AND t.deleted_at IS NULL
      AND t.status = 'concluido'
  LOOP
    v_desc_parts := string_to_array(v_snapshot.description, ':');
    v_desc_stage_key := CASE WHEN array_length(v_desc_parts, 1) >= 3 THEN v_desc_parts[3] ELSE v_snapshot.stage_text END;
    v_scoring_stage_key := COALESCE(NULLIF(v_desc_stage_key, ''), v_snapshot.stage_text);

    v_is_tag_only_stage := v_scoring_stage_key IN ('design', 'edicao_videos');

    SELECT base_points, uses_quantity, extra_demand_multiplier, late_penalty
    INTO v_stage_base, v_stage_uses_qty, v_stage_extra_mult, v_stage_late_penalty
    FROM public.scoring_config
    WHERE stage = v_scoring_stage_key
    LIMIT 1;

    IF v_is_tag_only_stage THEN
      v_stage_base := COALESCE(v_stage_base, 0);
      v_stage_uses_qty := true;
      IF v_stage_extra_mult IS NULL THEN
        v_stage_extra_mult := 1.5;
      END IF;
      v_stage_late_penalty := COALESCE(v_stage_late_penalty, 0);
    ELSE
      IF v_stage_base IS NULL THEN v_stage_base := 1; END IF;
      IF v_stage_uses_qty IS NULL THEN v_stage_uses_qty := false; END IF;
      IF v_stage_extra_mult IS NULL THEN
        v_stage_extra_mult := 1.5;
      END IF;
      v_stage_late_penalty := COALESCE(v_stage_late_penalty, -1);
    END IF;

    v_all_children_sum := 0;
    v_parent_late_sum := v_stage_late_penalty;
    v_unique_tag_keys := ARRAY[]::text[];

    IF v_stage_uses_qty THEN
      v_scoring_assignee := NULL;
      IF array_length(v_desc_parts, 1) >= 4 THEN
        v_scoring_assignee := v_desc_parts[4]::uuid;
      END IF;

      v_child_count := 0;

      FOR v_child_rec IN
        SELECT sub.id, sub.tags
        FROM public.pm_tasks sub
        WHERE sub.parent_task_id = _pm_task_id
          AND (v_scoring_assignee IS NULL OR COALESCE(sub.assignee_id, v_parent_assignee) = v_scoring_assignee)
      LOOP
        v_child_count := v_child_count + 1;
        v_child_tag_sum := 0;

        IF v_child_rec.tags IS NOT NULL AND array_length(v_child_rec.tags, 1) > 0 THEN
          FOREACH v_tag IN ARRAY v_child_rec.tags
          LOOP
            v_normalized := lower(split_part(v_tag, ':', 1));
            v_normalized := translate(v_normalized, 'áàãâéêíóôõúç', 'aaaaeeiooouc');
            v_normalized := replace(v_normalized, ' ', '_');
            v_tag_key := 'tag_' || v_normalized;

            SELECT base_points INTO v_tag_base
            FROM public.scoring_config
            WHERE stage = v_tag_key
            LIMIT 1;
            IF v_tag_base IS NOT NULL THEN
              v_child_tag_sum := v_child_tag_sum + v_tag_base;
            END IF;

            IF NOT v_tag_key = ANY(v_unique_tag_keys) THEN
              v_unique_tag_keys := v_unique_tag_keys || v_tag_key;
            END IF;
          END LOOP;
        END IF;

        v_all_children_sum := v_all_children_sum + v_stage_base + v_child_tag_sum;
      END LOOP;

      IF v_child_count = 0 THEN
        v_child_tag_sum := 0;
        v_tags_for_calc := v_parent_tags;
        IF v_tags_for_calc IS NOT NULL AND array_length(v_tags_for_calc, 1) > 0 THEN
          FOREACH v_tag IN ARRAY v_tags_for_calc
          LOOP
            v_normalized := lower(split_part(v_tag, ':', 1));
            v_normalized := translate(v_normalized, 'áàãâéêíóôõúç', 'aaaaeeiooouc');
            v_normalized := replace(v_normalized, ' ', '_');
            v_tag_key := 'tag_' || v_normalized;

            SELECT base_points INTO v_tag_base
            FROM public.scoring_config
            WHERE stage = v_tag_key
            LIMIT 1;
            IF v_tag_base IS NOT NULL THEN
              v_child_tag_sum := v_child_tag_sum + v_tag_base;
            END IF;

            IF NOT v_tag_key = ANY(v_unique_tag_keys) THEN
              v_unique_tag_keys := v_unique_tag_keys || v_tag_key;
            END IF;
          END LOOP;
        END IF;
        v_all_children_sum := (v_stage_base + v_child_tag_sum) * COALESCE(v_snapshot.quantity, 1);
      END IF;

      IF array_length(v_unique_tag_keys, 1) > 0 THEN
        FOREACH v_tag_key IN ARRAY v_unique_tag_keys
        LOOP
          SELECT late_penalty INTO v_tag_late
          FROM public.scoring_config
          WHERE stage = v_tag_key
          LIMIT 1;
          IF v_tag_late IS NOT NULL THEN
            v_parent_late_sum := v_parent_late_sum + v_tag_late;
          END IF;
        END LOOP;
      END IF;

      v_total_points := v_all_children_sum
        * CASE WHEN v_is_extra AND v_stage_extra_mult > 0 THEN v_stage_extra_mult ELSE 1 END;
      v_total_late_penalty := v_parent_late_sum;

    ELSE
      v_total_points := v_stage_base
        * CASE WHEN v_is_extra AND v_stage_extra_mult > 0 THEN v_stage_extra_mult ELSE 1 END;
      v_total_late_penalty := v_stage_late_penalty;
    END IF;

    UPDATE public.tasks
    SET point_value = v_total_points, late_penalty_value = v_total_late_penalty, updated_at = now()
    WHERE id = v_snapshot.id;

    IF NOT v_snapshot.assigned_user_id = ANY(v_affected_users) THEN
      v_affected_users := v_affected_users || v_snapshot.assigned_user_id;
    END IF;
  END LOOP;

  BEGIN
    FOREACH v_user IN ARRAY v_affected_users
    LOOP
      PERFORM public.recompute_all_scores(v_user, v_year, v_month);
    END LOOP;
  END;
END;
$function$;