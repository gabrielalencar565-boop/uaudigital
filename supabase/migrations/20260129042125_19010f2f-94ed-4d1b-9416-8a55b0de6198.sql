-- Atualiza a função para NÃO alterar tarefas ao marcar checklist.
-- Agora o checklist controla apenas a conclusão da etapa no ciclo (e legado),
-- enquanto a Agenda continua marcando a etapa quando concluir tarefas.

CREATE OR REPLACE FUNCTION public.toggle_stage_tasks_checklist(
  _client_id uuid,
  _stage public.stage_type,
  _year integer,
  _month integer
)
RETURNS TABLE(affected_tasks integer, new_status public.task_status, stage_completed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cycle_id uuid;
  current_stage_completed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid month';
  END IF;

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

  -- Toggle APENAS da etapa do ciclo (não mexe em tasks)
  SELECT COALESCE(completed, false)
  INTO current_stage_completed
  FROM public.client_cycle_stages
  WHERE cycle_id = v_cycle_id
    AND stage = _stage
  LIMIT 1;

  stage_completed := NOT COALESCE(current_stage_completed, false);
  new_status := CASE WHEN stage_completed THEN 'concluido' ELSE 'pendente' END;
  affected_tasks := 0;

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
    VALUES (
      v_cycle_id,
      _stage,
      stage_completed,
      CASE WHEN stage_completed THEN now() ELSE NULL END,
      CASE WHEN stage_completed THEN auth.uid() ELSE NULL END
    );
  END IF;

  RETURN NEXT;
END;
$$;
