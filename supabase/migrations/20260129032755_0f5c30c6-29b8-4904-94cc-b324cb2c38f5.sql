-- Função segura para concluir/reabrir tarefas pelo Checklist (qualquer usuário autenticado)
-- Regra: atua SOMENTE nas tarefas do cliente+etapa dentro do mês; se todas concluídas -> reabre (pendente), senão conclui.

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
  cycle_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid month';
  END IF;

  month_start := make_date(_year, _month, 1);
  month_end := (month_start + interval '1 month' - interval '1 day')::date;

  SELECT COUNT(*)::int,
         COALESCE(SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END), 0)::int
  INTO total_tasks, done_tasks
  FROM public.tasks
  WHERE client_id = _client_id
    AND stage = _stage
    AND due_date BETWEEN month_start AND month_end;

  IF total_tasks = 0 THEN
    affected_tasks := 0;
    new_status := 'pendente';
    stage_completed := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF done_tasks >= total_tasks THEN
    next_status := 'pendente';
  ELSE
    next_status := 'concluido';
  END IF;

  -- Atualiza tarefas + completed_at
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

  -- Mantém legado (client_stages) sincronizado
  UPDATE public.client_stages
  SET
    completed = stage_completed,
    completed_at = CASE WHEN stage_completed THEN now() ELSE NULL END,
    completed_by = CASE WHEN stage_completed THEN auth.uid() ELSE NULL END,
    updated_at = now()
  WHERE client_id = _client_id
    AND stage = _stage;

  -- Ciclo mensal (upsert ciclo + etapa)
  SELECT id INTO cycle_id
  FROM public.client_cycles
  WHERE client_id = _client_id
    AND year = _year
    AND month = _month
  LIMIT 1;

  IF cycle_id IS NULL THEN
    INSERT INTO public.client_cycles (client_id, year, month, due_date)
    VALUES (_client_id, _year, _month, make_date(_year, _month, 27))
    RETURNING id INTO cycle_id;
  END IF;

  -- Upsert na etapa do ciclo
  UPDATE public.client_cycle_stages
  SET
    completed = stage_completed,
    completed_at = CASE WHEN stage_completed THEN now() ELSE NULL END,
    completed_by = CASE WHEN stage_completed THEN auth.uid() ELSE NULL END,
    updated_at = now()
  WHERE cycle_id = cycle_id
    AND stage = _stage;

  IF NOT FOUND THEN
    INSERT INTO public.client_cycle_stages (cycle_id, stage, completed, completed_at, completed_by)
    VALUES (cycle_id, _stage, stage_completed,
            CASE WHEN stage_completed THEN now() ELSE NULL END,
            CASE WHEN stage_completed THEN auth.uid() ELSE NULL END);
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_stage_tasks_checklist(uuid, public.stage_type, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_stage_tasks_checklist(uuid, public.stage_type, int, int) TO authenticated;
