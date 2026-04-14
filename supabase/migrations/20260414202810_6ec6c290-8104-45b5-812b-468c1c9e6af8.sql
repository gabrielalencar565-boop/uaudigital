
CREATE OR REPLACE FUNCTION public.pm_recalc_tag_points(_pm_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_scoring_assignee uuid;
  v_is_tag_only_stage boolean;
  v_child_rec RECORD;
  v_tag text;
  v_tag_key text;
  v_tag_base numeric;
  v_tag_late numeric;
  v_normalized text;
  v_child_tag_sum numeric;
  v_child_late_sum numeric;
  v_all_children_sum numeric;
  v_all_children_late numeric;
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

    v_is_tag_only_stage := v_snapshot.stage_text IN ('design', 'edicao_videos');

    SELECT base_points, uses_quantity, extra_demand_multiplier, late_penalty
    INTO v_stage_base, v_stage_uses_qty, v_stage_extra_mult, v_stage_late_penalty
    FROM public.scoring_config
    WHERE stage = v_snapshot.stage_text
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
    v_all_children_late := 0;

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
        v_child_late_sum := 0;

        IF v_child_rec.tags IS NOT NULL AND array_length(v_child_rec.tags, 1) > 0 THEN
          FOREACH v_tag IN ARRAY v_child_rec.tags
          LOOP
            v_normalized := lower(split_part(v_tag, ':', 1));
            v_normalized := replace(v_normalized, 'á', 'a');
            v_normalized := replace(v_normalized, 'à', 'a');
            v_normalized := replace(v_normalized, 'ã', 'a');
            v_normalized := replace(v_normalized, 'â', 'a');
            v_normalized := replace(v_normalized, 'é', 'e');
            v_normalized := replace(v_normalized, 'ê', 'e');
            v_normalized := replace(v_normalized, 'í', 'i');
            v_normalized := replace(v_normalized, 'ó', 'o');
            v_normalized := replace(v_normalized, 'ô', 'o');
            v_normalized := replace(v_normalized, 'õ', 'o');
            v_normalized := replace(v_normalized, 'ú', 'u');
            v_normalized := replace(v_normalized, 'ç', 'c');
            v_normalized := replace(v_normalized, ' ', '_');
            v_tag_key := 'tag_' || v_normalized;

            SELECT base_points, late_penalty INTO v_tag_base, v_tag_late
            FROM public.scoring_config
            WHERE stage = v_tag_key
            LIMIT 1;
            IF v_tag_base IS NOT NULL THEN
              v_child_tag_sum := v_child_tag_sum + v_tag_base;
            END IF;
            IF v_tag_late IS NOT NULL THEN
              v_child_late_sum := v_child_late_sum + v_tag_late;
            END IF;
          END LOOP;
        END IF;

        v_all_children_sum := v_all_children_sum + v_stage_base + v_child_tag_sum;
        v_all_children_late := v_all_children_late + v_stage_late_penalty + v_child_late_sum;
      END LOOP;

      IF v_child_count = 0 THEN
        v_child_tag_sum := 0;
        v_child_late_sum := 0;
        v_tags_for_calc := v_parent_tags;
        IF v_tags_for_calc IS NOT NULL AND array_length(v_tags_for_calc, 1) > 0 THEN
          FOREACH v_tag IN ARRAY v_tags_for_calc
          LOOP
            v_normalized := lower(split_part(v_tag, ':', 1));
            v_normalized := replace(v_normalized, 'á', 'a');
            v_normalized := replace(v_normalized, 'à', 'a');
            v_normalized := replace(v_normalized, 'ã', 'a');
            v_normalized := replace(v_normalized, 'â', 'a');
            v_normalized := replace(v_normalized, 'é', 'e');
            v_normalized := replace(v_normalized, 'ê', 'e');
            v_normalized := replace(v_normalized, 'í', 'i');
            v_normalized := replace(v_normalized, 'ó', 'o');
            v_normalized := replace(v_normalized, 'ô', 'o');
            v_normalized := replace(v_normalized, 'õ', 'o');
            v_normalized := replace(v_normalized, 'ú', 'u');
            v_normalized := replace(v_normalized, 'ç', 'c');
            v_normalized := replace(v_normalized, ' ', '_');
            v_tag_key := 'tag_' || v_normalized;

            SELECT base_points, late_penalty INTO v_tag_base, v_tag_late
            FROM public.scoring_config
            WHERE stage = v_tag_key
            LIMIT 1;
            IF v_tag_base IS NOT NULL THEN
              v_child_tag_sum := v_child_tag_sum + v_tag_base;
            END IF;
            IF v_tag_late IS NOT NULL THEN
              v_child_late_sum := v_child_late_sum + v_tag_late;
            END IF;
          END LOOP;
        END IF;
        v_all_children_sum := (v_stage_base + v_child_tag_sum) * COALESCE(v_snapshot.quantity, 1);
        v_all_children_late := (v_stage_late_penalty + v_child_late_sum) * COALESCE(v_snapshot.quantity, 1);
      END IF;

      v_total_points := v_all_children_sum
        * CASE WHEN v_is_extra AND v_stage_extra_mult > 0 THEN v_stage_extra_mult ELSE 1 END;
      v_total_late_penalty := v_all_children_late;

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
$$;
