-- ============================================================
-- Pontuação 100% automática baseada em tarefas
-- ============================================================

-- Atualizar a função recompute_metas_prazos para calcular TODAS as 5 categorias
-- baseado exclusivamente nas tarefas do usuário no mês

CREATE OR REPLACE FUNCTION public.recompute_all_scores(_user_id uuid, _year integer, _month integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  FROM public.tasks
  WHERE assigned_user_id = _user_id
    AND date_trunc('month', due_date::timestamp) = make_date(_year, _month, 1)::timestamp;

  -- ============================================================
  -- Cálculo das 5 categorias (todas baseadas em tarefas)
  -- ============================================================
  
  -- 1. METAS/PRAZOS (máx 3 pts) - Entregas no prazo menos atrasos
  -- +1 por tarefa no prazo, -1 por tarefa atrasada (com override se existir)
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
  WHERE t.assigned_user_id = _user_id
    AND t.status = 'concluido'
    AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp;

  -- 2. APRENDIZADO CONTÍNUO (máx 2 pts) - Variedade de etapas trabalhadas
  -- 2 pts se trabalhou em 4+ etapas diferentes, 1 pt se 2-3 etapas, 0 se 0-1
  SELECT CASE
    WHEN COUNT(DISTINCT stage) >= 4 THEN 2
    WHEN COUNT(DISTINCT stage) >= 2 THEN 1
    ELSE 0
  END
  INTO aprendizado_pts
  FROM public.tasks
  WHERE assigned_user_id = _user_id
    AND status = 'concluido'
    AND date_trunc('month', due_date::timestamp) = make_date(_year, _month, 1)::timestamp;

  -- 3. PADRÃO QUALIDADE UAU (máx 1 pt) - Taxa de conclusão alta
  -- 1 pt se concluiu >= 80% das tarefas atribuídas, 0 caso contrário
  IF total_tasks > 0 THEN
    qualidade_pts := CASE WHEN (completed_tasks::float / total_tasks) >= 0.8 THEN 1 ELSE 0 END;
  ELSE
    qualidade_pts := 0;
  END IF;

  -- 4. AMBIENTE ORGANIZADO (máx 1 pt) - Entregas antecipadas
  -- 1 pt se >= 30% das tarefas foram entregues antes do prazo
  IF completed_tasks > 0 THEN
    organizacao_pts := CASE WHEN (early_tasks::float / completed_tasks) >= 0.3 THEN 1 ELSE 0 END;
  ELSE
    organizacao_pts := 0;
  END IF;

  -- 5. COMPROMETIMENTO (máx 1 pt) - Volume de trabalho
  -- 1 pt se concluiu >= 5 tarefas no mês
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
$$;

-- Atualizar o trigger para usar a nova função
CREATE OR REPLACE FUNCTION public.tasks_sync_all_scores()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  y_new int;
  m_new int;
  y_old int;
  m_old int;
BEGIN
  y_new := EXTRACT(YEAR FROM NEW.due_date)::int;
  m_new := EXTRACT(MONTH FROM NEW.due_date)::int;

  -- Recalcula TODAS as pontuações para o responsável/mês
  PERFORM public.recompute_all_scores(NEW.assigned_user_id, y_new, m_new);

  -- Se mudou assigned_user_id ou due_date, recalcula também o antigo
  IF TG_OP = 'UPDATE' THEN
    y_old := EXTRACT(YEAR FROM OLD.due_date)::int;
    m_old := EXTRACT(MONTH FROM OLD.due_date)::int;

    IF (OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id)
       OR (OLD.due_date IS DISTINCT FROM NEW.due_date)
       OR (OLD.status IS DISTINCT FROM NEW.status)
    THEN
      PERFORM public.recompute_all_scores(OLD.assigned_user_id, y_old, m_old);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- Remover trigger antigo e criar novo
DROP TRIGGER IF EXISTS tasks_sync_metas_prazos ON public.tasks;
CREATE TRIGGER tasks_sync_all_scores
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_sync_all_scores();