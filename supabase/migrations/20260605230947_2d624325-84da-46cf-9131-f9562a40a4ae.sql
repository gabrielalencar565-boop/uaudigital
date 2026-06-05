
-- Limpa magic2_clients órfãos (sem link para clients existentes) + ciclos/estágios
WITH orphans AS (
  SELECT mc.id
  FROM public.magic2_clients mc
  WHERE NOT EXISTS (
    SELECT 1 FROM public.magic2_client_links l
    JOIN public.clients c ON c.id = l.agenda_client_id
    WHERE l.magic2_client_id = mc.id
  )
),
del_stages AS (
  DELETE FROM public.magic2_cycle_stages s
  USING public.magic2_cycles cy
  WHERE s.cycle_id = cy.id AND cy.client_id IN (SELECT id FROM orphans)
  RETURNING 1
),
del_cycles AS (
  DELETE FROM public.magic2_cycles WHERE client_id IN (SELECT id FROM orphans) RETURNING 1
),
del_links AS (
  DELETE FROM public.magic2_client_links WHERE magic2_client_id IN (SELECT id FROM orphans) RETURNING 1
)
DELETE FROM public.magic2_clients WHERE id IN (SELECT id FROM orphans);

-- Atualiza trigger de cleanup ao deletar cliente para também remover o magic2_clients
-- (quando não houver mais nenhum link válido restante)
CREATE OR REPLACE FUNCTION public.cleanup_client_magic2_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_magic2_ids uuid[];
BEGIN
  SELECT array_agg(magic2_client_id)
  INTO v_magic2_ids
  FROM public.magic2_client_links
  WHERE agenda_client_id = OLD.id;

  DELETE FROM public.magic2_client_links WHERE agenda_client_id = OLD.id;

  IF v_magic2_ids IS NOT NULL THEN
    DELETE FROM public.magic2_cycle_stages s
    USING public.magic2_cycles c
    WHERE s.cycle_id = c.id
      AND c.client_id = ANY(v_magic2_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.magic2_client_links l2
        WHERE l2.magic2_client_id = c.client_id
      );

    DELETE FROM public.magic2_cycles c
    WHERE c.client_id = ANY(v_magic2_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.magic2_client_links l2
        WHERE l2.magic2_client_id = c.client_id
      );

    DELETE FROM public.magic2_clients mc
    WHERE mc.id = ANY(v_magic2_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.magic2_client_links l2
        WHERE l2.magic2_client_id = mc.id
      );
  END IF;

  RETURN OLD;
END;
$$;
