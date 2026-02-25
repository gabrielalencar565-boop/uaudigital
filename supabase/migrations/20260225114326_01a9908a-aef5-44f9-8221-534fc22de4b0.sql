
CREATE OR REPLACE FUNCTION public.magic2_seed_year(_year integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_magic2_client_id uuid;
  v_cycle_id uuid;
  m int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _year < 2000 OR _year > 2100 THEN
    RAISE EXCEPTION 'Invalid year';
  END IF;

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
        VALUES (v_magic2_client_id, _year, m, make_date(_year, m, 27), true)
        RETURNING id INTO v_cycle_id;

        INSERT INTO public.magic2_cycle_stages (cycle_id, stage, completed)
        SELECT v_cycle_id, unnest(enum_range(NULL::public.magic2_stage_type)), false;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;
