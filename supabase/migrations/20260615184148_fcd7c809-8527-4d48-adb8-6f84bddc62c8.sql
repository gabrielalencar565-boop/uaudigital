CREATE OR REPLACE FUNCTION public.whatsapp_phone_key(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v text;
  d text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  v := lower(trim(_raw));
  IF v = '' THEN RETURN NULL; END IF;

  IF v LIKE '%-group' THEN RETURN v; END IF;
  IF v LIKE '%-lid' THEN RETURN v; END IF;

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

  IF position('-' in v) > 0 THEN
    RETURN replace(v, '@g.us', '');
  END IF;

  d := regexp_replace(v, '\D', '', 'g');
  IF length(d) = 0 THEN RETURN NULL; END IF;
  IF length(d) > 15 THEN RETURN d || '-group'; END IF;

  IF left(d, 2) = '55' AND length(d) >= 12 THEN
    d := substring(d from 3);
  END IF;

  IF length(d) = 11 AND substring(d from 3 for 1) = '9' THEN
    RETURN left(d, 2) || right(d, 8);
  END IF;

  RETURN right(d, 10);
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    WITH normalized AS (
      SELECT
        c.*,
        public.whatsapp_phone_key(c.phone_e164) AS normalized_key
      FROM public.whatsapp_contacts c
      WHERE c.phone_key IS NOT NULL
    ), ranked AS (
      SELECT
        *,
        first_value(phone_key) OVER (
          PARTITION BY normalized_key
          ORDER BY
            CASE WHEN user_id IS NOT NULL OR origin = 'colaborador' THEN 0 ELSE 1 END,
            last_message_at DESC NULLS LAST,
            updated_at DESC NULLS LAST,
            created_at ASC
        ) AS target_key
      FROM normalized
      WHERE normalized_key IS NOT NULL
    )
    SELECT DISTINCT phone_key AS old_key, target_key, normalized_key
    FROM ranked
    WHERE phone_key <> target_key
  LOOP
    UPDATE public.whatsapp_messages m
    SET contact_phone_key = r.target_key,
        contact_phone = COALESCE(c.phone_e164, m.contact_phone)
    FROM public.whatsapp_contacts c
    WHERE c.phone_key = r.target_key
      AND m.contact_phone_key = r.old_key;

    UPDATE public.whatsapp_contacts target
    SET name = COALESCE(NULLIF(target.name, ''), source.name),
        profile_pic_url = COALESCE(target.profile_pic_url, source.profile_pic_url),
        last_message_at = GREATEST(target.last_message_at, source.last_message_at),
        updated_at = now()
    FROM public.whatsapp_contacts source
    WHERE target.phone_key = r.target_key
      AND source.phone_key = r.old_key;

    DELETE FROM public.whatsapp_contacts c
    WHERE c.phone_key = r.old_key
      AND NOT EXISTS (
        SELECT 1 FROM public.whatsapp_messages m WHERE m.contact_phone_key = r.old_key
      );

    PERFORM public.whatsapp_rebuild_contact_summary(r.target_key);
  END LOOP;
END $$;

UPDATE public.whatsapp_contacts c
SET phone_key = public.whatsapp_phone_key(c.phone_e164),
    origin = CASE WHEN c.user_id IS NOT NULL THEN 'colaborador' ELSE c.origin END,
    updated_at = now()
WHERE public.whatsapp_phone_key(c.phone_e164) IS NOT NULL
  AND c.phone_key IS DISTINCT FROM public.whatsapp_phone_key(c.phone_e164)
  AND NOT EXISTS (
    SELECT 1
    FROM public.whatsapp_contacts other
    WHERE other.id <> c.id
      AND other.phone_key = public.whatsapp_phone_key(c.phone_e164)
  );

UPDATE public.whatsapp_messages m
SET contact_phone_key = public.whatsapp_phone_key(m.contact_phone)
WHERE public.whatsapp_phone_key(m.contact_phone) IS NOT NULL
  AND m.contact_phone_key IS DISTINCT FROM public.whatsapp_phone_key(m.contact_phone)
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_contacts c
    WHERE c.phone_key = public.whatsapp_phone_key(m.contact_phone)
  );

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT phone_key
    FROM public.whatsapp_contacts
    WHERE phone_key IS NOT NULL
  LOOP
    PERFORM public.whatsapp_rebuild_contact_summary(r.phone_key);
  END LOOP;
END $$;