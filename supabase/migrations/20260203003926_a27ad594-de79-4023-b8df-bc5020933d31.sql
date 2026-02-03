-- 1. Adiciona coluna deleted_at para soft delete
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2. Adiciona coluna deleted_by para saber quem excluiu
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- 3. Cria índice para filtrar tarefas ativas
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks (deleted_at) WHERE deleted_at IS NULL;

-- 4. Cria função para desmarcar etapas do Magic2 quando uma tarefa é excluída
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

      -- Verifica se há outras tarefas concluídas para este cliente/etapa/mês
      SELECT EXISTS (
        SELECT 1 FROM public.tasks t
        INNER JOIN public.magic2_client_links l ON l.agenda_client_id = t.client_id
        WHERE l.magic2_client_id = v_magic2_client_id
          AND t.stage::text = v_stage::text
          AND EXTRACT(YEAR FROM t.due_date) = v_year
          AND EXTRACT(MONTH FROM t.due_date) = v_month
          AND t.status = 'concluido'
          AND t.deleted_at IS NULL
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

-- 5. Cria trigger para soft delete
DROP TRIGGER IF EXISTS task_soft_delete_uncheck_magic_trigger ON public.tasks;
CREATE TRIGGER task_soft_delete_uncheck_magic_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.task_soft_delete_uncheck_magic();

-- 6. Cria função para restaurar tarefa e remarcar etapas
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

-- 7. Cria trigger para restauração
DROP TRIGGER IF EXISTS task_restore_check_magic_trigger ON public.tasks;
CREATE TRIGGER task_restore_check_magic_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.task_restore_check_magic();