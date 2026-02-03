-- Atualiza o trigger para recalcular TODAS as pontuações (não apenas metas_prazos)
CREATE OR REPLACE FUNCTION public.tasks_sync_metas_prazos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  y_new int;
  m_new int;
  y_old int;
  m_old int;
  assignee_record RECORD;
BEGIN
  -- mês/ano da tarefa (baseado no due_date)
  y_new := EXTRACT(YEAR FROM NEW.due_date)::int;
  m_new := EXTRACT(MONTH FROM NEW.due_date)::int;

  -- Recalcula TODAS as pontuações para o responsável principal
  PERFORM public.recompute_all_scores(NEW.assigned_user_id, y_new, m_new);

  -- Recalcula para TODOS os assignees adicionais da tarefa
  FOR assignee_record IN 
    SELECT user_id FROM public.task_assignees WHERE task_id = NEW.id
  LOOP
    PERFORM public.recompute_all_scores(assignee_record.user_id, y_new, m_new);
  END LOOP;

  -- Se mudou assigned_user_id ou due_date, recalcula também o "antigo" lado
  IF TG_OP = 'UPDATE' THEN
    y_old := EXTRACT(YEAR FROM OLD.due_date)::int;
    m_old := EXTRACT(MONTH FROM OLD.due_date)::int;

    IF (OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id)
       OR (OLD.due_date IS DISTINCT FROM NEW.due_date)
       OR (OLD.status IS DISTINCT FROM NEW.status)
    THEN
      -- Recalcula antigo responsável principal
      PERFORM public.recompute_all_scores(OLD.assigned_user_id, y_old, m_old);
      
      -- Recalcula antigos assignees (se mudou o mês/ano)
      IF y_old <> y_new OR m_old <> m_new THEN
        FOR assignee_record IN 
          SELECT user_id FROM public.task_assignees WHERE task_id = OLD.id
        LOOP
          PERFORM public.recompute_all_scores(assignee_record.user_id, y_old, m_old);
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

-- Também atualiza o trigger de task_assignees para recalcular todas as pontuações
CREATE OR REPLACE FUNCTION public.task_assignees_sync_metas_prazos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  task_due_date date;
  y int;
  m int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Busca due_date da tarefa
    SELECT due_date INTO task_due_date FROM public.tasks WHERE id = NEW.task_id;
    IF task_due_date IS NOT NULL THEN
      y := EXTRACT(YEAR FROM task_due_date)::int;
      m := EXTRACT(MONTH FROM task_due_date)::int;
      PERFORM public.recompute_all_scores(NEW.user_id, y, m);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Busca due_date da tarefa
    SELECT due_date INTO task_due_date FROM public.tasks WHERE id = OLD.task_id;
    IF task_due_date IS NOT NULL THEN
      y := EXTRACT(YEAR FROM task_due_date)::int;
      m := EXTRACT(MONTH FROM task_due_date)::int;
      PERFORM public.recompute_all_scores(OLD.user_id, y, m);
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;