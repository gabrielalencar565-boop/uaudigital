
-- =====================================================
-- Atualiza recompute_metas_prazos para considerar task_assignees
-- Agora uma tarefa pontua para:
-- 1. O assigned_user_id (responsável principal)
-- 2. Todos os user_id em task_assignees (colaboradores)
-- =====================================================

CREATE OR REPLACE FUNCTION public.recompute_metas_prazos(_user_id uuid, _year integer, _month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  points int;
BEGIN
  -- Authorization: only self or admin can recompute for a user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
  THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Input validation
  IF _year < 2000 OR _year > 2100 OR _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid year or month';
  END IF;

  -- Calcula pontos considerando:
  -- 1. Tarefas onde o usuário é o assigned_user_id (responsável principal)
  -- 2. Tarefas onde o usuário está em task_assignees (colaborador)
  SELECT COALESCE(
    SUM(
      COALESCE(o.override_points,
        CASE
          WHEN t.completed_at IS NULL THEN 0
          WHEN (t.completed_at::date <= t.due_date) THEN 1
          ELSE -1
        END
      )
    ),
    0
  )::int
  INTO points
  FROM public.tasks t
  LEFT JOIN public.task_deadline_overrides o
    ON o.task_id = t.id
  WHERE t.status = 'concluido'
    AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
    AND (
      -- Usuário é o responsável principal
      t.assigned_user_id = _user_id
      OR
      -- OU usuário está como assignee adicional
      EXISTS (
        SELECT 1 FROM public.task_assignees ta 
        WHERE ta.task_id = t.id AND ta.user_id = _user_id
      )
    );

  INSERT INTO public.performance_scores (
    user_id,
    year,
    month,
    metas_prazos,
    created_by
  ) VALUES (
    _user_id,
    _year,
    _month,
    points,
    _user_id
  )
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET metas_prazos = EXCLUDED.metas_prazos, updated_at = now();
END;
$function$;

-- =====================================================
-- Atualiza recompute_all_scores para considerar task_assignees
-- =====================================================

CREATE OR REPLACE FUNCTION public.recompute_all_scores(_user_id uuid, _year integer, _month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_tasks int := 0;
  completed_tasks int := 0;
  on_time_tasks int := 0;
  late_tasks int := 0;
  early_tasks int := 0;
  
  -- Pontuações calculadas
  metas_prazos_pts int := 0;
  aprendizado_pts int := 0;
  qualidade_pts int := 0;
  organizacao_pts int := 0;
  comprometimento_pts int := 0;
BEGIN
  -- Authorization
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _year < 2000 OR _year > 2100 OR _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid year or month';
  END IF;

  -- Conta as tarefas do usuário no mês
  -- Considera assigned_user_id OU task_assignees
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'concluido'),
    COUNT(*) FILTER (WHERE status = 'concluido' AND completed_at::date <= due_date),
    COUNT(*) FILTER (WHERE status = 'concluido' AND completed_at::date > due_date),
    COUNT(*) FILTER (WHERE status = 'concluido' AND completed_at::date < due_date)
  INTO 
    total_tasks, 
    completed_tasks, 
    on_time_tasks, 
    late_tasks,
    early_tasks
  FROM public.tasks t
  WHERE date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
    AND (
      t.assigned_user_id = _user_id
      OR EXISTS (
        SELECT 1 FROM public.task_assignees ta 
        WHERE ta.task_id = t.id AND ta.user_id = _user_id
      )
    );

  -- ============================================================
  -- Cálculo das 5 categorias (todas baseadas em tarefas)
  -- ============================================================
  
  -- 1. METAS/PRAZOS (máx 3 pts) - Entregas no prazo menos atrasos
  SELECT COALESCE(
    SUM(
      COALESCE(o.override_points,
        CASE
          WHEN t.completed_at IS NULL THEN 0
          WHEN (t.completed_at::date <= t.due_date) THEN 1
          ELSE -1
        END
      )
    ),
    0
  )::int
  INTO metas_prazos_pts
  FROM public.tasks t
  LEFT JOIN public.task_deadline_overrides o ON o.task_id = t.id
  WHERE t.status = 'concluido'
    AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
    AND (
      t.assigned_user_id = _user_id
      OR EXISTS (
        SELECT 1 FROM public.task_assignees ta 
        WHERE ta.task_id = t.id AND ta.user_id = _user_id
      )
    );

  -- 2. APRENDIZADO CONTÍNUO (máx 2 pts) - Variedade de etapas trabalhadas
  SELECT CASE
    WHEN COUNT(DISTINCT stage) >= 4 THEN 2
    WHEN COUNT(DISTINCT stage) >= 2 THEN 1
    ELSE 0
  END
  INTO aprendizado_pts
  FROM public.tasks t
  WHERE t.status = 'concluido'
    AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
    AND (
      t.assigned_user_id = _user_id
      OR EXISTS (
        SELECT 1 FROM public.task_assignees ta 
        WHERE ta.task_id = t.id AND ta.user_id = _user_id
      )
    );

  -- 3. PADRÃO QUALIDADE UAU (máx 1 pt) - Taxa de conclusão alta
  IF total_tasks > 0 THEN
    qualidade_pts := CASE WHEN (completed_tasks::float / total_tasks) >= 0.8 THEN 1 ELSE 0 END;
  ELSE
    qualidade_pts := 0;
  END IF;

  -- 4. AMBIENTE ORGANIZADO (máx 1 pt) - Entregas antecipadas
  IF completed_tasks > 0 THEN
    organizacao_pts := CASE WHEN (early_tasks::float / completed_tasks) >= 0.3 THEN 1 ELSE 0 END;
  ELSE
    organizacao_pts := 0;
  END IF;

  -- 5. COMPROMETIMENTO (máx 1 pt) - Volume de trabalho
  comprometimento_pts := CASE WHEN completed_tasks >= 5 THEN 1 ELSE 0 END;

  -- Salvar pontuação
  INSERT INTO public.performance_scores (
    user_id, year, month,
    metas_prazos,
    aprendizado_continuo,
    padrao_qualidade_uau,
    ambiente_organizado,
    comprometimento,
    created_by
  ) VALUES (
    _user_id, _year, _month,
    metas_prazos_pts,
    aprendizado_pts,
    qualidade_pts,
    organizacao_pts,
    comprometimento_pts,
    _user_id
  )
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET 
    metas_prazos = EXCLUDED.metas_prazos,
    aprendizado_continuo = EXCLUDED.aprendizado_continuo,
    padrao_qualidade_uau = EXCLUDED.padrao_qualidade_uau,
    ambiente_organizado = EXCLUDED.ambiente_organizado,
    comprometimento = EXCLUDED.comprometimento,
    updated_at = now();
END;
$function$;

-- =====================================================
-- Atualiza o trigger para recalcular para TODOS os assignees
-- =====================================================

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

  -- Recalcula para o responsável principal
  PERFORM public.recompute_metas_prazos(NEW.assigned_user_id, y_new, m_new);

  -- Recalcula para TODOS os assignees adicionais da tarefa
  FOR assignee_record IN 
    SELECT user_id FROM public.task_assignees WHERE task_id = NEW.id
  LOOP
    PERFORM public.recompute_metas_prazos(assignee_record.user_id, y_new, m_new);
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
      PERFORM public.recompute_metas_prazos(OLD.assigned_user_id, y_old, m_old);
      
      -- Recalcula antigos assignees (se mudou o mês/ano)
      IF y_old <> y_new OR m_old <> m_new THEN
        FOR assignee_record IN 
          SELECT user_id FROM public.task_assignees WHERE task_id = OLD.id
        LOOP
          PERFORM public.recompute_metas_prazos(assignee_record.user_id, y_old, m_old);
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

-- =====================================================
-- Trigger para recalcular quando assignees são adicionados/removidos
-- =====================================================

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
      PERFORM public.recompute_metas_prazos(NEW.user_id, y, m);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Busca due_date da tarefa
    SELECT due_date INTO task_due_date FROM public.tasks WHERE id = OLD.task_id;
    IF task_due_date IS NOT NULL THEN
      y := EXTRACT(YEAR FROM task_due_date)::int;
      m := EXTRACT(MONTH FROM task_due_date)::int;
      PERFORM public.recompute_metas_prazos(OLD.user_id, y, m);
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

-- Cria o trigger na tabela task_assignees
DROP TRIGGER IF EXISTS task_assignees_sync_metas_prazos_trigger ON public.task_assignees;

CREATE TRIGGER task_assignees_sync_metas_prazos_trigger
  AFTER INSERT OR DELETE ON public.task_assignees
  FOR EACH ROW
  EXECUTE FUNCTION public.task_assignees_sync_metas_prazos();
