create or replace function public.magic2_seed_year(_year integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  r record;
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  m int;
  v_day int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _year < 2000 OR _year > 2100 THEN
    RAISE EXCEPTION 'Invalid year';
  END IF;

  v_day := public.current_magic_number_day();

  -- Exclui o cliente sentinela Freelancer
  FOR r IN SELECT id FROM public.clients WHERE is_freelancer_sentinel = false LOOP
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
        VALUES (v_magic2_client_id, _year, m, make_date(_year, m, v_day), true)
        RETURNING id INTO v_cycle_id;

        INSERT INTO public.magic2_cycle_stages (cycle_id, stage, completed)
        SELECT v_cycle_id, unnest(enum_range(NULL::public.magic2_stage_type)), false;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

create or replace function public.magic2_sync_from_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  v_year int;
  v_month int;
  v_stage public.magic2_stage_type;
  v_is_freelancer boolean;
BEGIN
  -- IGNORA demandas extras
  IF NEW.is_extra_demand = true THEN
    RETURN NULL;
  END IF;

  -- IGNORA clientes freelancer (sentinela)
  SELECT is_freelancer_sentinel INTO v_is_freelancer
  FROM public.clients WHERE id = NEW.client_id;
  IF v_is_freelancer = true THEN
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

  -- Mapeia stage_type -> magic2_stage_type
  BEGIN
    v_stage := NEW.stage::text::public.magic2_stage_type;
  EXCEPTION WHEN others THEN
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

  SELECT id INTO v_cycle_id
  FROM public.magic2_cycles
  WHERE client_id = v_magic2_client_id
    AND year = v_year
    AND month = v_month
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    INSERT INTO public.magic2_cycles (client_id, year, month, due_date, is_active)
    VALUES (v_magic2_client_id, v_year, v_month, make_date(v_year, v_month, public.current_magic_number_day()), true)
    RETURNING id INTO v_cycle_id;

    INSERT INTO public.magic2_cycle_stages (cycle_id, stage, completed)
    SELECT v_cycle_id, unnest(enum_range(NULL::public.magic2_stage_type)), false;
  END IF;

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
