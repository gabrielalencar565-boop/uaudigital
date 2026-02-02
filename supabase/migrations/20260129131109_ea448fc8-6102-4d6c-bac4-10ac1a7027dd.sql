-- 1) Trigger para sincronizar Magic v2 quando uma task for concluída (por due_date)
DO $$
BEGIN
  -- evita erro se já existir
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'tr_magic2_sync_from_task'
  ) THEN
    CREATE TRIGGER tr_magic2_sync_from_task
    AFTER INSERT OR UPDATE OF status ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.magic2_sync_from_task();
  END IF;
END $$;

-- 2) Função utilitária: garantir que todo cliente da Agenda exista no Magic v2 (1:1)
CREATE OR REPLACE FUNCTION public.magic2_ensure_client_link(_agenda_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_magic2_client_id uuid;
  v_name text;
BEGIN
  SELECT l.magic2_client_id
  INTO v_magic2_client_id
  FROM public.magic2_client_links l
  WHERE l.agenda_client_id = _agenda_client_id
  LIMIT 1;

  IF v_magic2_client_id IS NOT NULL THEN
    RETURN v_magic2_client_id;
  END IF;

  SELECT c.name
  INTO v_name
  FROM public.clients c
  WHERE c.id = _agenda_client_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Agenda client not found';
  END IF;

  INSERT INTO public.magic2_clients (name)
  VALUES (v_name)
  RETURNING id INTO v_magic2_client_id;

  INSERT INTO public.magic2_client_links (magic2_client_id, agenda_client_id)
  VALUES (v_magic2_client_id, _agenda_client_id);

  RETURN v_magic2_client_id;
END;
$$;

-- 3) Seed de um ano: cria ciclos/etapas para todos os clientes da Agenda
CREATE OR REPLACE FUNCTION public.magic2_seed_year(_year int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  m int;
BEGIN
  FOR r IN SELECT id FROM public.clients LOOP
    v_magic2_client_id := public.magic2_ensure_client_link(r.id);

    FOR m IN 1..12 LOOP
      SELECT id INTO v_cycle_id
      FROM public.magic2_cycles
      WHERE client_id = v_magic2_client_id
        AND year = _year
        AND month = m
      LIMIT 1;

      IF v_cycle_id IS NULL THEN
        INSERT INTO public.magic2_cycles (client_id, year, month, due_date, is_active)
        VALUES (v_magic2_client_id, _year, m, make_date(_year, m, 27), true)
        RETURNING id INTO v_cycle_id;

        INSERT INTO public.magic2_cycle_stages (cycle_id, stage, completed)
        SELECT v_cycle_id, unnest(enum_range(NULL::public.magic2_stage_type)), false;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- roda seed para o ano atual (test environment)
SELECT public.magic2_seed_year(EXTRACT(YEAR FROM now())::int);
