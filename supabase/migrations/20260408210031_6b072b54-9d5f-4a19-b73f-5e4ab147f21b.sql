
CREATE OR REPLACE FUNCTION public.pm_resync_correction(_pm_task_id uuid, _completed_stage text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_users uuid[];
  v_user uuid;
  v_due_date date;
  v_year int;
  v_month int;
  v_assignee_id uuid;
  v_new_users uuid[];
BEGIN
  -- Get task info
  SELECT due_date, assignee_id
  INTO v_due_date, v_assignee_id
  FROM public.pm_tasks
  WHERE id = _pm_task_id;

  IF v_due_date IS NULL THEN v_due_date := CURRENT_DATE; END IF;
  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  -- Track old affected users before cleanup
  SELECT array_agg(DISTINCT assigned_user_id)
  INTO v_old_users
  FROM public.tasks
  WHERE (
    description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
    OR description LIKE 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':%'
  )
  AND deleted_at IS NULL;

  -- Delete all existing scoring records for this pm_task + stage
  DELETE FROM public.tasks
  WHERE (
    description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
    OR description LIKE 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':%'
  )
  AND deleted_at IS NULL;

  -- Re-sync scoring (will create fresh records with current assignee distribution)
  PERFORM public.pm_sync_stage_completion(
    _pm_task_id,
    _completed_stage,
    COALESCE(v_assignee_id, auth.uid()),
    NULL::uuid[]
  );

  -- Recalculate tag points
  PERFORM public.pm_recalc_tag_points(_pm_task_id);

  -- Track new affected users
  SELECT array_agg(DISTINCT assigned_user_id)
  INTO v_new_users
  FROM public.tasks
  WHERE (
    description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
    OR description LIKE 'pm:' || _pm_task_id::text || ':' || _completed_stage || ':%'
  )
  AND deleted_at IS NULL;

  -- Recompute scores for old users (who may have lost points)
  IF v_old_users IS NOT NULL THEN
    FOREACH v_user IN ARRAY v_old_users
    LOOP
      PERFORM public.recompute_all_scores(v_user, v_year, v_month);
    END LOOP;
  END IF;

  -- Recompute scores for new users
  IF v_new_users IS NOT NULL THEN
    FOREACH v_user IN ARRAY v_new_users
    LOOP
      IF v_old_users IS NULL OR NOT v_user = ANY(v_old_users) THEN
        PERFORM public.recompute_all_scores(v_user, v_year, v_month);
      END IF;
    END LOOP;
  END IF;
END;
$$;
