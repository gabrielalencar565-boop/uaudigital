-- 1) Schema: pause/end timeline columns
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS paused_from date,
  ADD COLUMN IF NOT EXISTS resumed_from date,
  ADD COLUMN IF NOT EXISTS ended_at date;

ALTER TABLE public.financial_clients
  ADD COLUMN IF NOT EXISTS paused_from date,
  ADD COLUMN IF NOT EXISTS resumed_from date,
  ADD COLUMN IF NOT EXISTS ended_at date;

-- 2) Helper: timeline status at a (year, month)
CREATE OR REPLACE FUNCTION public.client_status_at(p_client uuid, p_year int, p_month int)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN c.id IS NULL THEN 'desconhecido'
    WHEN c.contract_start IS NOT NULL
         AND make_date(p_year, p_month, 1) < date_trunc('month', c.contract_start::timestamp)::date
      THEN 'fora_periodo'
    WHEN c.ended_at IS NOT NULL
         AND date_trunc('month', c.ended_at::timestamp)::date <= make_date(p_year, p_month, 1)
      THEN 'encerrado'
    WHEN c.paused_from IS NOT NULL
         AND date_trunc('month', c.paused_from::timestamp)::date <= make_date(p_year, p_month, 1)
         AND (c.resumed_from IS NULL
              OR date_trunc('month', c.resumed_from::timestamp)::date > make_date(p_year, p_month, 1))
      THEN 'pausado'
    ELSE 'ativo'
  END
  FROM public.clients c WHERE c.id = p_client;
$$;

GRANT EXECUTE ON FUNCTION public.client_status_at(uuid, int, int) TO anon, authenticated;

-- 3) Normalize helper
CREATE OR REPLACE FUNCTION public._norm_client_name(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(extensions.unaccent(coalesce(t, ''))),
      '^(dra?\.?|sr\.?|sra\.?)\s+', '', 'i'
    ),
    '\s+', ' ', 'g'
  )
$$;

-- 4) Pré-passo: garantir financial_clients com id IGUAL ao clients.id para todo client
--    (assim o merge subsequente sempre cai no caminho "destino existe")
INSERT INTO public.financial_clients (id, name, monthly_value, contract_start, contract_months, is_active, notes)
SELECT c.id, c.name, COALESCE(c.monthly_value, 0), COALESCE(c.contract_start, CURRENT_DATE), 12, c.is_active, c.notes
FROM public.clients c
WHERE c.is_freelancer_sentinel = false
  AND NOT EXISTS (SELECT 1 FROM public.financial_clients f WHERE f.id = c.id);

-- 5) Merge financial_clients duplicados em clients.id por nome normalizado
DO $$
DECLARE
  r record;
  v_client_id uuid;
  v_target_value numeric;
  v_target_start date;
  v_target_months int;
BEGIN
  FOR r IN
    SELECT * FROM public.financial_clients
    WHERE id NOT IN (SELECT id FROM public.clients WHERE is_freelancer_sentinel = false)
  LOOP
    SELECT c.id INTO v_client_id
    FROM public.clients c
    WHERE public._norm_client_name(c.name) = public._norm_client_name(r.name)
      AND c.is_freelancer_sentinel = false
    LIMIT 1;

    IF v_client_id IS NOT NULL THEN
      -- Preserva valores do registro antigo (que tem dados reais) no destino
      SELECT monthly_value, contract_start, contract_months
      INTO v_target_value, v_target_start, v_target_months
      FROM public.financial_clients WHERE id = v_client_id;

      UPDATE public.financial_clients
      SET monthly_value = CASE WHEN COALESCE(v_target_value,0) > 0 THEN v_target_value ELSE r.monthly_value END,
          contract_start = COALESCE(v_target_start, r.contract_start),
          contract_months = COALESCE(NULLIF(v_target_months, 12), r.contract_months, 12),
          updated_at = now()
      WHERE id = v_client_id;

      -- Move revenues
      UPDATE public.financial_revenues SET client_id = v_client_id WHERE client_id = r.id;
      -- Remove duplicata
      DELETE FROM public.financial_clients WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- 6) Espelha o nome de clients em financial_clients
UPDATE public.financial_clients f
SET name = c.name, updated_at = now()
FROM public.clients c
WHERE f.id = c.id AND f.name <> c.name;

-- 7) Espelha monthly_value de financial_clients de volta em clients quando clients está zerado
UPDATE public.clients c
SET monthly_value = f.monthly_value, updated_at = now()
FROM public.financial_clients f
WHERE c.id = f.id
  AND COALESCE(c.monthly_value, 0) = 0
  AND COALESCE(f.monthly_value, 0) > 0;

-- 8) Atualiza trigger para sempre sincronizar pausa/encerramento
CREATE OR REPLACE FUNCTION public.sync_client_to_modules()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing_fin uuid;
  v_magic_link uuid;
  v_magic2_id uuid;
BEGIN
  IF NEW.is_freelancer_sentinel = true THEN RETURN NEW; END IF;

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
END $$;

-- 9) Força sync atual dos nomes/valores via trigger
UPDATE public.clients SET updated_at = now() WHERE is_freelancer_sentinel = false;

-- 10) Cleanup
DROP FUNCTION IF EXISTS public._norm_client_name(text);