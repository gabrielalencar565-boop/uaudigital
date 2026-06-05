
-- 1) Novas colunas em clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS manager_id uuid,
  ADD COLUMN IF NOT EXISTS plan_name text,
  ADD COLUMN IF NOT EXISTS monthly_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_start date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS participates_magic boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS participates_ranking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_goals boolean NOT NULL DEFAULT false;

-- 2) Função de sincronização
CREATE OR REPLACE FUNCTION public.sync_client_to_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_fin uuid;
  v_magic_link uuid;
  v_magic2_id uuid;
BEGIN
  IF NEW.is_freelancer_sentinel = true THEN
    RETURN NEW;
  END IF;

  -- ── Financial sync ──
  SELECT id INTO v_existing_fin
  FROM public.financial_clients
  WHERE id = NEW.id
  LIMIT 1;

  IF v_existing_fin IS NULL THEN
    INSERT INTO public.financial_clients (id, name, monthly_value, contract_start, is_active, notes)
    VALUES (NEW.id, NEW.name, COALESCE(NEW.monthly_value, 0), COALESCE(NEW.contract_start, CURRENT_DATE), NEW.is_active, NEW.notes)
    ON CONFLICT (id) DO NOTHING;
  ELSE
    UPDATE public.financial_clients
    SET name = NEW.name,
        monthly_value = COALESCE(NEW.monthly_value, monthly_value),
        contract_start = COALESCE(NEW.contract_start, contract_start),
        is_active = NEW.is_active,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;

  -- ── Magic2 link (opt-in) ──
  IF NEW.participates_magic = true THEN
    SELECT id INTO v_magic_link
    FROM public.magic2_client_links
    WHERE agenda_client_id = NEW.id
    LIMIT 1;

    IF v_magic_link IS NULL THEN
      INSERT INTO public.magic2_clients (name) VALUES (NEW.name) RETURNING id INTO v_magic2_id;
      INSERT INTO public.magic2_client_links (magic2_client_id, agenda_client_id)
      VALUES (v_magic2_id, NEW.id);
    ELSE
      UPDATE public.magic2_clients m
      SET name = NEW.name, updated_at = now()
      FROM public.magic2_client_links l
      WHERE l.id = v_magic_link AND m.id = l.magic2_client_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_sync_modules ON public.clients;
CREATE TRIGGER clients_sync_modules
AFTER INSERT OR UPDATE OF name, is_active, monthly_value, contract_start, participates_magic, notes
ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_to_modules();
