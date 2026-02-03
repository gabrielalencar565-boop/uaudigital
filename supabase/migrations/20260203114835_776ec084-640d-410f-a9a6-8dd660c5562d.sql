-- Atualiza o trigger magic2_sync_from_task para ignorar tarefas de demanda extra
CREATE OR REPLACE FUNCTION public.magic2_sync_from_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  v_year int;
  v_month int;
  v_stage public.magic2_stage_type;
BEGIN
  -- IGNORA demandas extras (não sincroniza com Magic Number)
  IF NEW.is_extra_demand = true THEN
    RETURN NULL;
  END IF;

  -- Só quando status muda para concluído
  IF TG_OP = 'UPDATE' THEN
    IF NOT (NEW.status = 'concluido' AND (OLD.status IS DISTINCT FROM NEW.status)) THEN
      RETURN NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'concluido' THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Mapeia stage_type -> magic2_stage_type (ignora etapas fora do Magic)
  BEGIN
    v_stage := NEW.stage::text::public.magic2_stage_type;
  EXCEPTION WHEN others THEN
    -- ex.: revisao/entrega (ou qualquer outro) não entra no Magic v2
    RETURN NULL;
  END;

  -- Encontra cliente Magic v2 vinculado
  SELECT l.magic2_client_id
  INTO v_magic2_client_id
  FROM public.magic2_client_links l
  WHERE l.agenda_client_id = NEW.client_id
  LIMIT 1;

  IF v_magic2_client_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_year := EXTRACT(YEAR FROM NEW.due_date)::int;
  v_month := EXTRACT(MONTH FROM NEW.due_date)::int;

  -- Garante ciclo do mês (due_date fixo dia 27)
  SELECT id INTO v_cycle_id
  FROM public.magic2_cycles
  WHERE client_id = v_magic2_client_id
    AND year = v_year
    AND month = v_month
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    INSERT INTO public.magic2_cycles (client_id, year, month, due_date, is_active)
    VALUES (v_magic2_client_id, v_year, v_month, make_date(v_year, v_month, 27), true)
    RETURNING id INTO v_cycle_id;

    -- Inicializa as 7 etapas nesse ciclo recém-criado
    INSERT INTO public.magic2_cycle_stages (cycle_id, stage, completed)
    SELECT v_cycle_id, unnest(enum_range(NULL::public.magic2_stage_type)), false;
  END IF;

  -- Marca etapa como concluída (não desmarca nunca aqui)
  UPDATE public.magic2_cycle_stages
  SET
    completed = true,
    completed_at = COALESCE(NEW.completed_at, now()),
    completed_by = NEW.assigned_user_id,
    updated_at = now()
  WHERE cycle_id = v_cycle_id
    AND stage = v_stage;

  IF NOT FOUND THEN
    INSERT INTO public.magic2_cycle_stages (cycle_id, stage, completed, completed_at, completed_by)
    VALUES (v_cycle_id, v_stage, true, COALESCE(NEW.completed_at, now()), NEW.assigned_user_id);
  END IF;

  RETURN NULL;
END;
$function$;

-- Atualiza task_soft_delete_uncheck_magic para ignorar demandas extras
CREATE OR REPLACE FUNCTION public.task_soft_delete_uncheck_magic()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  v_year int;
  v_month int;
  v_stage public.magic2_stage_type;
  has_other_completed_tasks boolean;
BEGIN
  -- IGNORA demandas extras
  IF OLD.is_extra_demand = true THEN
    RETURN NEW;
  END IF;

  -- Só quando deleted_at muda de NULL para um valor (soft delete)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- Só se a tarefa estava concluída
    IF OLD.status = 'concluido' THEN
      -- Mapeia stage_type -> magic2_stage_type
      BEGIN
        v_stage := OLD.stage::text::public.magic2_stage_type;
      EXCEPTION WHEN others THEN
        RETURN NEW;
      END;

      -- Encontra cliente Magic v2 vinculado
      SELECT l.magic2_client_id
      INTO v_magic2_client_id
      FROM public.magic2_client_links l
      WHERE l.agenda_client_id = OLD.client_id
      LIMIT 1;

      IF v_magic2_client_id IS NULL THEN
        RETURN NEW;
      END IF;

      v_year := EXTRACT(YEAR FROM OLD.due_date)::int;
      v_month := EXTRACT(MONTH FROM OLD.due_date)::int;

      -- Encontra o ciclo
      SELECT id INTO v_cycle_id
      FROM public.magic2_cycles
      WHERE client_id = v_magic2_client_id
        AND year = v_year
        AND month = v_month
      LIMIT 1;

      IF v_cycle_id IS NULL THEN
        RETURN NEW;
      END IF;

      -- Verifica se há outras tarefas concluídas para este cliente/etapa/mês (IGNORA demandas extras)
      SELECT EXISTS (
        SELECT 1 FROM public.tasks t
        INNER JOIN public.magic2_client_links l ON l.agenda_client_id = t.client_id
        WHERE l.magic2_client_id = v_magic2_client_id
          AND t.stage::text = v_stage::text
          AND EXTRACT(YEAR FROM t.due_date) = v_year
          AND EXTRACT(MONTH FROM t.due_date) = v_month
          AND t.status = 'concluido'
          AND t.deleted_at IS NULL
          AND t.is_extra_demand = false
          AND t.id <> OLD.id
      ) INTO has_other_completed_tasks;

      -- Se não há outras tarefas concluídas, desmarca a etapa
      IF NOT has_other_completed_tasks THEN
        UPDATE public.magic2_cycle_stages
        SET
          completed = false,
          completed_at = NULL,
          completed_by = NULL,
          updated_at = now()
        WHERE cycle_id = v_cycle_id
          AND stage = v_stage;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Atualiza task_restore_check_magic para ignorar demandas extras
CREATE OR REPLACE FUNCTION public.task_restore_check_magic()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  v_year int;
  v_month int;
  v_stage public.magic2_stage_type;
BEGIN
  -- IGNORA demandas extras
  IF NEW.is_extra_demand = true THEN
    RETURN NEW;
  END IF;

  -- Só quando deleted_at muda de um valor para NULL (restauração)
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    -- Só se a tarefa está concluída
    IF NEW.status = 'concluido' THEN
      -- Mapeia stage_type -> magic2_stage_type
      BEGIN
        v_stage := NEW.stage::text::public.magic2_stage_type;
      EXCEPTION WHEN others THEN
        RETURN NEW;
      END;

      -- Encontra cliente Magic v2 vinculado
      SELECT l.magic2_client_id
      INTO v_magic2_client_id
      FROM public.magic2_client_links l
      WHERE l.agenda_client_id = NEW.client_id
      LIMIT 1;

      IF v_magic2_client_id IS NULL THEN
        RETURN NEW;
      END IF;

      v_year := EXTRACT(YEAR FROM NEW.due_date)::int;
      v_month := EXTRACT(MONTH FROM NEW.due_date)::int;

      -- Encontra ou cria o ciclo
      SELECT id INTO v_cycle_id
      FROM public.magic2_cycles
      WHERE client_id = v_magic2_client_id
        AND year = v_year
        AND month = v_month
      LIMIT 1;

      IF v_cycle_id IS NULL THEN
        INSERT INTO public.magic2_cycles (client_id, year, month, due_date, is_active)
        VALUES (v_magic2_client_id, v_year, v_month, make_date(v_year, v_month, 27), true)
        RETURNING id INTO v_cycle_id;

        INSERT INTO public.magic2_cycle_stages (cycle_id, stage, completed)
        SELECT v_cycle_id, unnest(enum_range(NULL::public.magic2_stage_type)), false;
      END IF;

      -- Marca a etapa como concluída
      UPDATE public.magic2_cycle_stages
      SET
        completed = true,
        completed_at = COALESCE(NEW.completed_at, now()),
        completed_by = NEW.assigned_user_id,
        updated_at = now()
      WHERE cycle_id = v_cycle_id
        AND stage = v_stage;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;