-- FIX: recompute_metas_prazos was using simplified +1/-1 logic and ignoring point_value/late_penalty_value.
-- This caused triggers (tasks_sync_metas_prazos, task_assignees_sync_metas_prazos, etc.) to overwrite
-- correct scores with the simplified count whenever a task changed. Redirect it to recompute_all_scores
-- so all triggers use the canonical scoring logic (which already handles old/new period rules and tag points).

CREATE OR REPLACE FUNCTION public.recompute_metas_prazos(_user_id uuid, _year integer, _month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS NULL OR _year IS NULL OR _month IS NULL THEN
    RETURN;
  END IF;
  PERFORM public.recompute_all_scores(_user_id, _year, _month);
END;
$function$;

-- Restore correct scores for every user/month that exists in performance_scores
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id, year, month FROM public.performance_scores
  LOOP
    PERFORM public.recompute_all_scores(r.user_id, r.year, r.month);
  END LOOP;

  -- Also recompute current month for anyone with tasks in it, in case row didn't exist yet
  FOR r IN
    SELECT DISTINCT t.assigned_user_id AS user_id,
           EXTRACT(YEAR FROM t.due_date)::int AS year,
           EXTRACT(MONTH FROM t.due_date)::int AS month
    FROM public.tasks t
    WHERE t.deleted_at IS NULL
      AND t.assigned_user_id IS NOT NULL
      AND t.due_date IS NOT NULL
      AND t.due_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '2 months'
  LOOP
    PERFORM public.recompute_all_scores(r.user_id, r.year, r.month);
  END LOOP;
END $$;