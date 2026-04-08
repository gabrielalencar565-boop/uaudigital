
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
  v_normalized text;
BEGIN
  SELECT tags, is_extra_demand, due_date, assignee_id
  INTO v_tags, v_is_extra, v_due_date, v_parent_assignee
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

    SELECT base_points, uses_quantity, extra_demand_multiplier
    INTO v_stage_base, v_stage_uses_qty, v_stage_extra_mult
    FROM public.scoring_config
    WHERE stage = v_snapshot.stage_text
    LIMIT 1;

    IF v_stage_base IS NULL THEN v_stage_base := 1; END IF;
    IF v_stage_uses_qty IS NULL THEN v_stage_uses_qty := false; END IF;
    IF v_stage_extra_mult IS NULL THEN v_stage_extra_mult := 1.5; END IF;

    v_tag_points := 0;
    IF v_stage_uses_qty THEN
      IF array_length(v_desc_parts, 1) >= 4 THEN
        v_scoring_assignee := v_desc_parts[4]::uuid;
        SELECT array_agg(DISTINCT t_tag)
        INTO v_tags
        FROM public.pm_tasks sub, unnest(sub.tags) AS t_tag
        WHERE sub.parent_task_id = _pm_task_id
          AND COALESCE(sub.assignee_id, v_parent_assignee) = v_scoring_assignee
          AND sub.tags IS NOT NULL
          AND array_length(sub.tags, 1) > 0;
      ELSE
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

      IF v_tags IS NOT NULL AND array_length(v_tags, 1) > 0 THEN
        FOREACH v_tag IN ARRAY v_tags
        LOOP
          -- Normalize: lowercase + remove common accents
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
          v_tag_key := 'tag_' || v_normalized;
          
          SELECT base_points INTO v_tag_base
          FROM public.scoring_config
          WHERE stage = v_tag_key
          LIMIT 1;
          IF v_tag_base IS NOT NULL THEN
            v_tag_points := v_tag_points + v_tag_base;
          END IF;
        END LOOP;
      END IF;
    END IF;

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
