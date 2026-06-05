-- 1) Estender sync_client_to_modules para atualizar magic2_cycles.is_active baseado em status
CREATE OR REPLACE FUNCTION public.sync_client_to_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_fin uuid;
  v_magic_link uuid;
  v_magic2_id uuid;
  v_magic2_client_id uuid;
  v_paused_target int;
  v_resumed_target int;
  v_ended_target int;
BEGIN
  IF NEW.is_freelancer_sentinel = true THEN RETURN NEW; END IF;

  -- Financeiro
  IF COALESCE(NEW.appears_in_financial, true) = false THEN
    DELETE FROM public.financial_revenues WHERE client_id = NEW.id;
    DELETE FROM public.financial_clients WHERE id = NEW.id;
  ELSE
    SELECT id INTO v_existing_fin FROM public.financial_clients WHERE id = NEW.id LIMIT 1;
    IF v_existing_fin IS NULL THEN
      INSERT INTO public.financial_clients
        (id, name, monthly_value, contract_start, is_active, notes, paused_from, resumed_from, ended_at)
      VALUES
        (NEW.id, NEW.name, COALESCE(NEW.monthly_value, 0),
         COALESCE(NEW.contract_start, CURRENT_DATE), NEW.is_active, NEW.notes,
         NEW.paused_from, NEW.resumed_from, NEW.ended_at)
      ON CONFLICT (id) DO NOTHING;
    ELSE
      UPDATE public.financial_clients
      SET name = NEW.name,
          monthly_value = COALESCE(NEW.monthly_value, monthly_value),
          contract_start = COALESCE(NEW.contract_start, contract_start),
          is_active = NEW.is_active,
          paused_from = NEW.paused_from,
          resumed_from = NEW.resumed_from,
          ended_at = NEW.ended_at,
          updated_at = now()
      WHERE id = NEW.id;
    END IF;
  END IF;

  -- Magic Number: cria/atualiza vínculo se participa
  IF NEW.participates_magic = true THEN
    SELECT id INTO v_magic_link FROM public.magic2_client_links WHERE agenda_client_id = NEW.id LIMIT 1;
    IF v_magic_link IS NULL THEN
      INSERT INTO public.magic2_clients (name) VALUES (NEW.name) RETURNING id INTO v_magic2_id;
      INSERT INTO public.magic2_client_links (magic2_client_id, agenda_client_id) VALUES (v_magic2_id, NEW.id);
    ELSE
      UPDATE public.magic2_clients m SET name = NEW.name, updated_at = now()
      FROM public.magic2_client_links l WHERE l.id = v_magic_link AND m.id = l.magic2_client_id;
    END IF;
  END IF;

  -- Sincroniza magic2_cycles.is_active conforme pausa/encerramento do cliente
  SELECT magic2_client_id INTO v_magic2_client_id
  FROM public.magic2_client_links WHERE agenda_client_id = NEW.id LIMIT 1;

  IF v_magic2_client_id IS NOT NULL THEN
    v_paused_target := CASE WHEN NEW.paused_from IS NOT NULL
      THEN EXTRACT(YEAR FROM NEW.paused_from)::int * 12 + EXTRACT(MONTH FROM NEW.paused_from)::int - 1
      ELSE NULL END;
    v_resumed_target := CASE WHEN NEW.resumed_from IS NOT NULL
      THEN EXTRACT(YEAR FROM NEW.resumed_from)::int * 12 + EXTRACT(MONTH FROM NEW.resumed_from)::int - 1
      ELSE NULL END;
    v_ended_target := CASE WHEN NEW.ended_at IS NOT NULL
      THEN EXTRACT(YEAR FROM NEW.ended_at)::int * 12 + EXTRACT(MONTH FROM NEW.ended_at)::int - 1
      ELSE NULL END;

    UPDATE public.magic2_cycles
    SET is_active = NOT (
          (v_ended_target IS NOT NULL AND (year * 12 + month - 1) >= v_ended_target)
          OR (
            v_paused_target IS NOT NULL
            AND (year * 12 + month - 1) >= v_paused_target
            AND (v_resumed_target IS NULL OR (year * 12 + month - 1) < v_resumed_target)
          )
        ),
        updated_at = now()
    WHERE client_id = v_magic2_client_id
      AND is_active <> NOT (
          (v_ended_target IS NOT NULL AND (year * 12 + month - 1) >= v_ended_target)
          OR (
            v_paused_target IS NOT NULL
            AND (year * 12 + month - 1) >= v_paused_target
            AND (v_resumed_target IS NULL OR (year * 12 + month - 1) < v_resumed_target)
          )
        );
  END IF;

  RETURN NEW;
END $function$;

-- 2) Recriar trigger incluindo paused_from, resumed_from, ended_at na lista de colunas
DROP TRIGGER IF EXISTS clients_sync_modules ON public.clients;
CREATE TRIGGER clients_sync_modules
  AFTER INSERT OR UPDATE OF name, is_active, monthly_value, contract_start, participates_magic, notes, appears_in_financial, paused_from, resumed_from, ended_at
  ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_to_modules();

-- 3) Trigger BEFORE DELETE — limpa magic2 quando cliente é apagado
CREATE OR REPLACE FUNCTION public.cleanup_client_magic2_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.magic2_cycle_stages
  WHERE cycle_id IN (
    SELECT id FROM public.magic2_cycles
    WHERE client_id IN (
      SELECT magic2_client_id FROM public.magic2_client_links WHERE agenda_client_id = OLD.id
    )
  );
  DELETE FROM public.magic2_cycles
  WHERE client_id IN (
    SELECT magic2_client_id FROM public.magic2_client_links WHERE agenda_client_id = OLD.id
  );
  DELETE FROM public.magic2_clients
  WHERE id IN (
    SELECT magic2_client_id FROM public.magic2_client_links WHERE agenda_client_id = OLD.id
  );
  DELETE FROM public.magic2_client_links WHERE agenda_client_id = OLD.id;
  RETURN OLD;
END $function$;

DROP TRIGGER IF EXISTS clients_cleanup_magic2 ON public.clients;
CREATE TRIGGER clients_cleanup_magic2
  BEFORE DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_client_magic2_on_delete();

-- 4) Backfill: aplica regra a todos os clientes existentes
UPDATE public.magic2_cycles mc
SET is_active = NOT (
      (c.ended_at IS NOT NULL
       AND (mc.year * 12 + mc.month - 1) >= EXTRACT(YEAR FROM c.ended_at)::int * 12 + EXTRACT(MONTH FROM c.ended_at)::int - 1)
      OR (
        c.paused_from IS NOT NULL
        AND (mc.year * 12 + mc.month - 1) >= EXTRACT(YEAR FROM c.paused_from)::int * 12 + EXTRACT(MONTH FROM c.paused_from)::int - 1
        AND (c.resumed_from IS NULL
             OR (mc.year * 12 + mc.month - 1) < EXTRACT(YEAR FROM c.resumed_from)::int * 12 + EXTRACT(MONTH FROM c.resumed_from)::int - 1)
      )
    ),
    updated_at = now()
FROM public.magic2_client_links l
JOIN public.clients c ON c.id = l.agenda_client_id
WHERE mc.client_id = l.magic2_client_id
  AND (c.paused_from IS NOT NULL OR c.ended_at IS NOT NULL);

-- 5) Limpa órfãos (vínculos apontando para clients inexistentes)
DELETE FROM public.magic2_cycle_stages
WHERE cycle_id IN (
  SELECT mc.id FROM public.magic2_cycles mc
  JOIN public.magic2_client_links l ON l.magic2_client_id = mc.client_id
  WHERE NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = l.agenda_client_id)
);
DELETE FROM public.magic2_cycles
WHERE client_id IN (
  SELECT l.magic2_client_id FROM public.magic2_client_links l
  WHERE NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = l.agenda_client_id)
);
DELETE FROM public.magic2_clients
WHERE id IN (
  SELECT l.magic2_client_id FROM public.magic2_client_links l
  WHERE NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = l.agenda_client_id)
);
DELETE FROM public.magic2_client_links l
WHERE NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = l.agenda_client_id);