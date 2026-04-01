
CREATE OR REPLACE FUNCTION public.pm_recalc_tag_points(_pm_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
BEGIN
  -- Get task info
  SELECT tags, is_extra_demand, due_date
  INTO v_tags, v_is_extra, v_due_date
  FROM public.pm_tasks
  WHERE id = _pm_task_id;

  IF v_due_date IS NULL THEN v_due_date := CURRENT_DATE; END IF;
  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  -- Count child tasks for quantity
  SELECT GREATEST(COUNT(*)::int, 1) INTO v_quantity
  FROM public.pm_tasks
  WHERE parent_task_id = _pm_task_id;

  -- Calculate total tag points
  v_tag_points := 0;
  IF v_tags IS NOT NULL AND array_length(v_tags, 1) > 0 THEN
    FOREACH v_tag IN ARRAY v_tags
    LOOP
      -- Tag format is "name:color", extract name and look up tag_<lowercase_name>
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

  -- For each snapshot task row, recalculate point_value
  FOR v_snapshot IN
    SELECT t.id, t.stage::text as stage_text, t.assigned_user_id
    FROM public.tasks t
    WHERE t.description LIKE 'pm:' || _pm_task_id::text || ':%'
      AND t.deleted_at IS NULL
      AND t.status = 'concluido'
  LOOP
    -- Get stage scoring config
    SELECT base_points, uses_quantity, extra_demand_multiplier
    INTO v_stage_base, v_stage_uses_qty, v_stage_extra_mult
    FROM public.scoring_config
    WHERE stage = v_snapshot.stage_text
    LIMIT 1;

    IF v_stage_base IS NULL THEN v_stage_base := 1; END IF;
    IF v_stage_uses_qty IS NULL THEN v_stage_uses_qty := false; END IF;
    IF v_stage_extra_mult IS NULL THEN v_stage_extra_mult := 1.5; END IF;

    -- Calculate: stage base + tag points, applying quantity and extra multipliers
    v_total_points := (v_stage_base + v_tag_points)
      * CASE WHEN v_stage_uses_qty THEN COALESCE(v_quantity, 1) ELSE 1 END
      * CASE WHEN v_is_extra AND v_stage_uses_qty THEN v_stage_extra_mult ELSE 1 END;

    UPDATE public.tasks
    SET point_value = v_total_points, updated_at = now()
    WHERE id = v_snapshot.id;

    -- Collect affected users
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
$function$;
