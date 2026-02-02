-- Security fix (warn): remove RLS bypass by making magic2_ensure_client_link run as INVOKER
-- This keeps the same behavior while ensuring normal RLS policies apply.

CREATE OR REPLACE FUNCTION public.magic2_ensure_client_link(_agenda_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_magic2_client_id uuid;
  v_name text;
BEGIN
  -- Require authentication (still needed even with INVOKER)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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
