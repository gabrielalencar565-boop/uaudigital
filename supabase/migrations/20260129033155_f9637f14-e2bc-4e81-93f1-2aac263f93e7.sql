-- Permitir toggle manual mesmo sem tarefas no mês, mantendo sincronização com client_cycle_stages/client_stages
CREATE OR REPLACE FUNCTION public.toggle_stage_tasks_checklist(
  _client_id uuid,
  _stage public.stage_type,
  _year int,
  _month int
)
RETURNS TABLE(
  affected_tasks int,
  new_status public.task_status,
  stage_completed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_start date;
  month_end date;
  total_tasks int;
  done_tasks int;
  next_status public.task_status;
  v_cycle_id uuid;
  current_stage_completed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid month';
  END IF;

  month_start := make_date(_year, _month, 1);
  month_end := (month_start + interval '1 month' - interval '1 day')::date;

  -- Garante ciclo
  SELECT id INTO v_cycle_id
  FROM public.client_cycles
  WHERE client_id = _client_id
    AND year = _year
    AND month = _month
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    INSERT INTO public.client_cycles (client_id, year, month, due_date)
    VALUES (_client_id, _year, _month, make_date(_year, _month, 27))
    RETURNING id INTO v_cycle_id;
  END IF;

  -- Contagem de tarefas
  SELECT COUNT(*)::int,
         COALESCE(SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END), 0)::int
  INTO total_tasks, done_tasks
  FROM public.tasks
  WHERE client_id = _client_id
    AND stage = _stage
    AND due_date BETWEEN month_start AND month_end;

  -- Se não houver tarefas, alterna manualmente baseado no estado atual da etapa do ciclo.
  IF total_tasks = 0 THEN
    SELECT COALESCE(completed, false)
    INTO current_stage_completed
    FROM public.client_cycle_stages
    WHERE cycle_id = v_cycle_id
      AND stage = _stage
    LIMIT 1;

    stage_completed := NOT COALESCE(current_stage_completed, false);
    new_status := CASE WHEN stage_completed THEN 'concluido' ELSE 'pendente' END;
    affected_tasks := 0;

  ELSE
    IF done_tasks >= total_tasks THEN
      next_status := 'pendente';
    ELSE
      next_status := 'concluido';
    END IF;

    UPDATE public.tasks
    SET
      status = next_status,
      completed_at = CASE WHEN next_status = 'concluido' THEN now() ELSE NULL END,
      updated_at = now()
    WHERE client_id = _client_id
      AND stage = _stage
      AND due_date BETWEEN month_start AND month_end;

    GET DIAGNOSTICS affected_tasks = ROW_COUNT;

    stage_completed := (next_status = 'concluido');
    new_status := next_status;
  END IF;

  -- Legado (client_stages)
  UPDATE public.client_stages
  SET
    completed = stage_completed,
    completed_at = CASE WHEN stage_completed THEN now() ELSE NULL END,
    completed_by = CASE WHEN stage_completed THEN auth.uid() ELSE NULL END,
    updated_at = now()
  WHERE client_id = _client_id
    AND stage = _stage;

  -- Upsert etapa do ciclo
  UPDATE public.client_cycle_stages
  SET
    completed = stage_completed,
    completed_at = CASE WHEN stage_completed THEN now() ELSE NULL END,
    completed_by = CASE WHEN stage_completed THEN auth.uid() ELSE NULL END,
    updated_at = now()
  WHERE public.client_cycle_stages.cycle_id = v_cycle_id
    AND public.client_cycle_stages.stage = _stage;

  IF NOT FOUND THEN
    INSERT INTO public.client_cycle_stages (cycle_id, stage, completed, completed_at, completed_by)
    VALUES (v_cycle_id, _stage, stage_completed,
            CASE WHEN stage_completed THEN now() ELSE NULL END,
            CASE WHEN stage_completed THEN auth.uid() ELSE NULL END);
  END IF;

  RETURN NEXT;
END;
$$;