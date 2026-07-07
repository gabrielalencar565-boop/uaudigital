DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pt.id, pt.stage_current::text AS stage_current, COALESCE(pt.assignee_id, (SELECT user_id FROM public.task_assignees WHERE task_id IS NULL LIMIT 0)) AS assignee_id
    FROM public.pm_tasks pt
    WHERE pt.periodic_stage_key IS NOT NULL
      AND pt.status_global = 'concluido'
      AND pt.deleted_at IS NULL
      AND pt.parent_task_id IS NULL
      AND pt.assignee_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.description LIKE 'pm:' || pt.id::text || ':%'
          AND t.deleted_at IS NULL
      )
  LOOP
    BEGIN
      PERFORM public.pm_sync_stage_completion(r.id, r.stage_current, r.assignee_id, NULL::uuid[]);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'skip % : %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;