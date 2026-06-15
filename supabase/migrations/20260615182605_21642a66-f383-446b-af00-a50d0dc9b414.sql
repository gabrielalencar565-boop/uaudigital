
-- 1) Atualiza função de chave
CREATE OR REPLACE FUNCTION public.whatsapp_phone_key(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE v text; d text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  v := lower(trim(_raw));
  IF v = '' THEN RETURN NULL; END IF;
  IF v LIKE '%-group' THEN RETURN v; END IF;
  IF v LIKE '%-lid'   THEN RETURN v; END IF;
  IF position('-' in v) > 0 AND v NOT LIKE '%@g.us' AND v NOT LIKE '%@lid' THEN
    RETURN replace(v, '@g.us', '');
  END IF;
  IF v LIKE '%@g.us' THEN
    d := regexp_replace(v, '\D', '', 'g');
    IF d = '' THEN RETURN NULL; END IF;
    RETURN d || '-group';
  END IF;
  IF v LIKE '%@lid' THEN
    d := regexp_replace(v, '\D', '', 'g');
    IF d = '' THEN RETURN NULL; END IF;
    RETURN d || '-lid';
  END IF;
  d := regexp_replace(v, '\D', '', 'g');
  IF length(d) = 0 THEN RETURN NULL; END IF;
  IF length(d) > 15 THEN RETURN d || '-group'; END IF;
  RETURN right(d, 10);
END;
$$;

-- 2) Triggers de contatos e mensagens (preservam forma canônica)
CREATE OR REPLACE FUNCTION public.whatsapp_contacts_set_phone_key()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k text;
BEGIN
  k := public.whatsapp_phone_key(NEW.phone_e164);
  NEW.phone_key := k;
  IF k IS NOT NULL AND (k LIKE '%-group' OR k LIKE '%-lid') THEN
    NEW.phone_e164 := k;
    IF k LIKE '%-group' THEN NEW.origin := 'grupo'; END IF;
  ELSIF NEW.phone_e164 IS NOT NULL AND position('-' in NEW.phone_e164) > 0 THEN
    NEW.phone_e164 := lower(replace(NEW.phone_e164, '@g.us', ''));
    NEW.origin := COALESCE(NEW.origin, 'grupo');
  ELSE
    NEW.phone_e164 := regexp_replace(COALESCE(NEW.phone_e164, ''), '\D', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_messages_set_phone_key()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k text;
BEGIN
  k := public.whatsapp_phone_key(NEW.contact_phone);
  NEW.contact_phone_key := k;
  IF k IS NOT NULL AND (k LIKE '%-group' OR k LIKE '%-lid') THEN
    NEW.contact_phone := k;
  ELSIF NEW.contact_phone IS NOT NULL AND position('-' in NEW.contact_phone) > 0 THEN
    NEW.contact_phone := lower(replace(NEW.contact_phone, '@g.us', ''));
  ELSE
    NEW.contact_phone := regexp_replace(COALESCE(NEW.contact_phone, ''), '\D', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Dedup baseado na NOVA chave antes do backfill
WITH calc AS (
  SELECT id, origin, last_message_at, updated_at, created_at,
         public.whatsapp_phone_key(phone_e164) AS new_key
  FROM public.whatsapp_contacts
),
ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY new_key
           ORDER BY
             CASE origin
               WHEN 'grupo'       THEN 1
               WHEN 'colaborador' THEN 2
               WHEN 'cliente'     THEN 3
               WHEN 'lead'        THEN 4
               ELSE 5
             END,
             COALESCE(last_message_at, updated_at, created_at) DESC NULLS LAST
         ) AS rn
  FROM calc WHERE new_key IS NOT NULL
)
DELETE FROM public.whatsapp_contacts c USING ranked r WHERE c.id = r.id AND r.rn > 1;

-- 4) Backfill mensagens
UPDATE public.whatsapp_messages SET contact_phone = contact_phone WHERE TRUE;

-- 5) Drop temporariamente a unique antiga em phone_e164 para o backfill (pode haver colisões transitórias)
ALTER TABLE public.whatsapp_contacts DROP CONSTRAINT IF EXISTS whatsapp_contacts_phone_e164_key;

-- 6) Backfill contatos
UPDATE public.whatsapp_contacts SET phone_e164 = phone_e164 WHERE TRUE;

-- 7) Recria unique em phone_e164
ALTER TABLE public.whatsapp_contacts ADD CONSTRAINT whatsapp_contacts_phone_e164_key UNIQUE (phone_e164);

-- 8) Limpa nomes poluídos
UPDATE public.whatsapp_contacts
SET name = NULL
WHERE name ILIKE 'uau digital%' AND origin <> 'colaborador';

-- 9) Recalcula resumos
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT phone_key FROM public.whatsapp_contacts WHERE phone_key IS NOT NULL LOOP
    PERFORM public.whatsapp_rebuild_contact_summary(r.phone_key);
  END LOOP;
END $$;

-- 10) Unicidade por phone_key
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_contacts_phone_key_uniq
  ON public.whatsapp_contacts(phone_key)
  WHERE phone_key IS NOT NULL;
