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
BEGIN
  IF NEW.is_freelancer_sentinel = true THEN RETURN NEW; END IF;

  -- Respeita a flag appears_in_financial: clientes ocultos não entram no Financeiro
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

  RETURN NEW;
END $function$;

-- Inclui a coluna no escopo do trigger para que mudanças na flag disparem o sync
DROP TRIGGER IF EXISTS clients_sync_modules ON public.clients;
CREATE TRIGGER clients_sync_modules
  AFTER INSERT OR UPDATE OF name, is_active, monthly_value, contract_start, participates_magic, notes, appears_in_financial
  ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_to_modules();