
-- Corrige a função recompute_metas_prazos para usar timezone do Brasil na comparação
CREATE OR REPLACE FUNCTION public.recompute_metas_prazos(_user_id uuid, _year integer, _month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  points int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
  THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _year < 2000 OR _year > 2100 OR _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid year or month';
  END IF;

  SELECT COALESCE(
    SUM(
      COALESCE(o.override_points,
        CASE
          WHEN t.completed_at IS NULL THEN 0
          -- Converte completed_at para timezone do Brasil antes de comparar
          WHEN ((t.completed_at AT TIME ZONE 'America/Sao_Paulo')::date <= t.due_date) THEN 1
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
    AND t.deleted_at IS NULL
    AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
    AND (
      t.assigned_user_id = _user_id
      OR
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

-- Também corrige a função recompute_all_scores que tem a mesma lógica
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
  
  metas_prazos_pts int := 0;
  aprendizado_pts int := 0;
  qualidade_pts int := 0;
  organizacao_pts int := 0;
  comprometimento_pts int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _year < 2000 OR _year > 2100 OR _month < 1 OR _month > 12 THEN
    RAISE EXCEPTION 'Invalid year or month';
  END IF;

  -- Conta as tarefas do usuário no mês (IGNORA LIXEIRA)
  -- Usa timezone do Brasil para comparar datas
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'concluido'),
    COUNT(*) FILTER (WHERE status = 'concluido' AND (completed_at AT TIME ZONE 'America/Sao_Paulo')::date <= due_date),
    COUNT(*) FILTER (WHERE status = 'concluido' AND (completed_at AT TIME ZONE 'America/Sao_Paulo')::date > due_date),
    COUNT(*) FILTER (WHERE status = 'concluido' AND (completed_at AT TIME ZONE 'America/Sao_Paulo')::date < due_date)
  INTO 
    total_tasks, 
    completed_tasks, 
    on_time_tasks, 
    late_tasks,
    early_tasks
  FROM public.tasks t
  WHERE date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
    AND t.deleted_at IS NULL
    AND (
      t.assigned_user_id = _user_id
      OR EXISTS (
        SELECT 1 FROM public.task_assignees ta 
        WHERE ta.task_id = t.id AND ta.user_id = _user_id
      )
    );

  -- METAS/PRAZOS (usa timezone do Brasil)
  SELECT COALESCE(
    SUM(
      COALESCE(o.override_points,
        CASE
          WHEN t.completed_at IS NULL THEN 0
          WHEN ((t.completed_at AT TIME ZONE 'America/Sao_Paulo')::date <= t.due_date) THEN 1
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
    AND t.deleted_at IS NULL
    AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
    AND (
      t.assigned_user_id = _user_id
      OR EXISTS (
        SELECT 1 FROM public.task_assignees ta 
        WHERE ta.task_id = t.id AND ta.user_id = _user_id
      )
    );

  -- APRENDIZADO CONTÍNUO (ignora lixeira)
  SELECT CASE
    WHEN COUNT(DISTINCT stage) >= 4 THEN 2
    WHEN COUNT(DISTINCT stage) >= 2 THEN 1
    ELSE 0
  END
  INTO aprendizado_pts
  FROM public.tasks t
  WHERE t.status = 'concluido'
    AND t.deleted_at IS NULL
    AND date_trunc('month', t.due_date::timestamp) = make_date(_year, _month, 1)::timestamp
    AND (
      t.assigned_user_id = _user_id
      OR EXISTS (
        SELECT 1 FROM public.task_assignees ta 
        WHERE ta.task_id = t.id AND ta.user_id = _user_id
      )
    );

  -- PADRÃO QUALIDADE UAU
  IF total_tasks > 0 THEN
    qualidade_pts := CASE WHEN (completed_tasks::float / total_tasks) >= 0.8 THEN 1 ELSE 0 END;
  ELSE
    qualidade_pts := 0;
  END IF;

  -- AMBIENTE ORGANIZADO
  IF completed_tasks > 0 THEN
    organizacao_pts := CASE WHEN (early_tasks::float / completed_tasks) >= 0.3 THEN 1 ELSE 0 END;
  ELSE
    organizacao_pts := 0;
  END IF;

  -- COMPROMETIMENTO
  comprometimento_pts := CASE WHEN completed_tasks >= 5 THEN 1 ELSE 0 END;

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
