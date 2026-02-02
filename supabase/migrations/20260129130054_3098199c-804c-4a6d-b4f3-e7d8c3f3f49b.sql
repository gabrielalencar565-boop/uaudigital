-- Magic v2: vínculo 1:1 com clientes da Agenda + sincronização Agenda -> Magic v2

-- 1) Tabela de vínculo entre clientes (Agenda) e Magic v2
CREATE TABLE IF NOT EXISTS public.magic2_client_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  magic2_client_id UUID NOT NULL UNIQUE REFERENCES public.magic2_clients(id) ON DELETE CASCADE,
  agenda_client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic2_client_links_agenda_client_id ON public.magic2_client_links(agenda_client_id);

ALTER TABLE public.magic2_client_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_client_links' AND policyname='magic2_client_links_select_authenticated') THEN
    CREATE POLICY magic2_client_links_select_authenticated
    ON public.magic2_client_links
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_client_links' AND policyname='magic2_client_links_insert_authenticated') THEN
    CREATE POLICY magic2_client_links_insert_authenticated
    ON public.magic2_client_links
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='magic2_client_links' AND policyname='magic2_client_links_delete_admin') THEN
    CREATE POLICY magic2_client_links_delete_admin
    ON public.magic2_client_links
    FOR DELETE
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 2) Função + trigger para sincronizar tarefa concluída -> etapa do Magic v2
-- Regra híbrida: tarefa concluída marca (true); reabrir NÃO desmarca.
CREATE OR REPLACE FUNCTION public.magic2_sync_from_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  v_year int;
  v_month int;
  v_stage public.magic2_stage_type;
BEGIN
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
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tasks_magic2_sync') THEN
    CREATE TRIGGER trg_tasks_magic2_sync
    AFTER INSERT OR UPDATE OF status
    ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.magic2_sync_from_task();
  END IF;
END $$;
