-- 1) Garantir updated_at automático e registrar completed_at nas tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE NULL;

-- Trigger de updated_at (já existe a função public.update_updated_at_column)
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função/trigger para controlar completed_at quando status muda
CREATE OR REPLACE FUNCTION public.set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'concluido' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_tasks_completed_at ON public.tasks;
CREATE TRIGGER set_tasks_completed_at
BEFORE UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_completed_at();


-- 2) Performance: garantir 1 linha por usuário/mês para permitir upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'performance_scores_user_year_month_key'
      AND conrelid = 'public.performance_scores'::regclass
  ) THEN
    ALTER TABLE public.performance_scores
    ADD CONSTRAINT performance_scores_user_year_month_key UNIQUE (user_id, year, month);
  END IF;
END;
$$;


-- 3) Função para recomputar metas_prazos (1 ponto por tarefa concluída no prazo, cap 3)
CREATE OR REPLACE FUNCTION public.recompute_metas_prazos(_user_id uuid, _year int, _month int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
  points int;
BEGIN
  SELECT COUNT(*)::int
  INTO cnt
  FROM public.tasks t
  WHERE t.assigned_user_id = _user_id
    AND t.status = 'concluido'
    AND t.completed_at IS NOT NULL
    AND (t.completed_at::date <= t.due_date)
    AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp;

  points := LEAST(3, GREATEST(0, cnt));

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
$$;


-- 4) Trigger nas tasks para manter metas_prazos sincronizado
CREATE OR REPLACE FUNCTION public.tasks_sync_metas_prazos()
RETURNS TRIGGER AS $$
DECLARE
  y_new int;
  m_new int;
  y_old int;
  m_old int;
BEGIN
  -- mês/ano da tarefa (baseado no due_date)
  y_new := EXTRACT(YEAR FROM NEW.due_date)::int;
  m_new := EXTRACT(MONTH FROM NEW.due_date)::int;

  -- Recalcula para o "novo" responsável/mês sempre que houver update relevante
  PERFORM public.recompute_metas_prazos(NEW.assigned_user_id, y_new, m_new);

  -- Se mudou assigned_user_id ou due_date, recalcula também o "antigo" lado
  IF TG_OP = 'UPDATE' THEN
    y_old := EXTRACT(YEAR FROM OLD.due_date)::int;
    m_old := EXTRACT(MONTH FROM OLD.due_date)::int;

    IF (OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id)
       OR (OLD.due_date IS DISTINCT FROM NEW.due_date)
       OR (OLD.status IS DISTINCT FROM NEW.status)
    THEN
      PERFORM public.recompute_metas_prazos(OLD.assigned_user_id, y_old, m_old);
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS tasks_sync_metas_prazos_trigger ON public.tasks;
CREATE TRIGGER tasks_sync_metas_prazos_trigger
AFTER INSERT OR UPDATE OF status, due_date, assigned_user_id ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.tasks_sync_metas_prazos();
