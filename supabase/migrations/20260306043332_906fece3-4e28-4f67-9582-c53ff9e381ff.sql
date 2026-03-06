
CREATE OR REPLACE FUNCTION public.pm_sync_stage_completion(
  _pm_task_id uuid,
  _completed_stage text,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_quantity int;
  v_existing_task_id uuid;
  v_is_freelancer boolean;
  v_assignee_id uuid;
BEGIN
  -- Get pm_task info
  SELECT client_id, due_date, title, parent_task_id, assignee_id
  INTO v_client_id, v_due_date, v_title, v_parent_task_id, v_assignee_id
  FROM public.pm_tasks
  WHERE id = _pm_task_id;

  IF v_client_id IS NULL THEN RETURN; END IF;

  -- Only sync root tasks (not subtasks)
  IF v_parent_task_id IS NOT NULL THEN RETURN; END IF;

  IF v_due_date IS NULL THEN v_due_date := CURRENT_DATE; END IF;

  -- Check if freelancer
  SELECT is_freelancer_sentinel INTO v_is_freelancer
  FROM public.clients WHERE id = v_client_id;
  IF v_is_freelancer = true THEN RETURN; END IF;

  -- Map completed_stage to stage_type
  BEGIN
    v_stage_type := _completed_stage::public.stage_type;
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  -- Count child tasks for quantity (subtasks in gestão)
  SELECT GREATEST(COUNT(*)::int, 1) INTO v_quantity
  FROM public.pm_tasks
  WHERE parent_task_id = _pm_task_id;

  v_year := EXTRACT(YEAR FROM v_due_date)::int;
  v_month := EXTRACT(MONTH FROM v_due_date)::int;

  -- Use provided user or task assignee
  IF _user_id IS NULL THEN
    _user_id := v_assignee_id;
  END IF;
  IF _user_id IS NULL THEN RETURN; END IF;

  -- ═══ MAGIC NUMBER SYNC ═══
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
            completed_by = _user_id,
            updated_at = now()
        WHERE cycle_id = v_cycle_id
          AND stage = v_magic2_stage
          AND completed = false;
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    NULL; -- Stage doesn't map to magic2
  END;

  -- ═══ PERFORMANCE SYNC (create task in tasks table) ═══
  -- Use description field as unique key: pm:{task_id}:{stage}
  SELECT id INTO v_existing_task_id
  FROM public.tasks
  WHERE description = 'pm:' || _pm_task_id::text || ':' || _completed_stage
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing_task_id IS NULL THEN
    INSERT INTO public.tasks (
      client_id, stage, assigned_user_id, due_date, created_by,
      status, quantity, title, description, completed_at
    ) VALUES (
      v_client_id, v_stage_type, _user_id, v_due_date, _user_id,
      'concluido'::public.task_status, v_quantity,
      v_title,
      'pm:' || _pm_task_id::text || ':' || _completed_stage,
      now()
    );
  ELSE
    UPDATE public.tasks
    SET status = 'concluido'::public.task_status,
        completed_at = now(),
        quantity = v_quantity,
        updated_at = now()
    WHERE id = v_existing_task_id;
  END IF;

  -- Recompute performance scores
  PERFORM public.recompute_all_scores(_user_id, v_year, v_month);
END;
$$;
