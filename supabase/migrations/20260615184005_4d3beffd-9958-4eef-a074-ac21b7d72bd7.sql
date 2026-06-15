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
  RETURN right(d, 10);
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_is_lid_alias(_key text, _lid text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF(_key, '') LIKE '%-lid'
    OR (
      regexp_replace(COALESCE(_lid, ''), '\D', '', 'g') <> ''
      AND NULLIF(_key, '') IN (
        regexp_replace(COALESCE(_lid, ''), '\D', '', 'g'),
        right(regexp_replace(COALESCE(_lid, ''), '\D', '', 'g'), 10)
      )
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_rebuild_contact_summary(_phone_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last record;
  v_unread integer;
BEGIN
  IF _phone_key IS NULL THEN
    RETURN;
  END IF;

  SELECT contact_phone, created_at, LEFT(COALESCE(body, media_type, ''), 200) AS preview
  INTO v_last
  FROM public.whatsapp_messages
  WHERE contact_phone_key = _phone_key
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT COUNT(*)::integer INTO v_unread
  FROM public.whatsapp_messages
  WHERE contact_phone_key = _phone_key
    AND direction = 'in';

  UPDATE public.whatsapp_contacts
  SET last_message_at = v_last.created_at,
      last_message_preview = v_last.preview,
      unread_count = COALESCE(v_unread, 0),
      updated_at = now()
  WHERE phone_key = _phone_key;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    WITH lid_keys AS (
      SELECT
        raw->>'chatLid' AS lid,
        contact_phone_key,
        max(created_at) AS last_at
      FROM public.whatsapp_messages
      WHERE raw ? 'chatLid'
        AND raw->>'chatLid' IS NOT NULL
        AND contact_phone_key IS NOT NULL
      GROUP BY raw->>'chatLid', contact_phone_key
    ), ranked AS (
      SELECT
        lid,
        contact_phone_key AS old_key,
        first_value(contact_phone_key) OVER (
          PARTITION BY lid
          ORDER BY
            CASE WHEN NOT public.whatsapp_is_lid_alias(contact_phone_key, lid) THEN 0 ELSE 1 END,
            last_at DESC,
            contact_phone_key
        ) AS target_key
      FROM lid_keys
    )
    SELECT DISTINCT old_key, target_key
    FROM ranked
    WHERE old_key <> target_key
      AND public.whatsapp_is_lid_alias(old_key, lid)
      AND NOT public.whatsapp_is_lid_alias(target_key, lid)
  LOOP
    UPDATE public.whatsapp_messages m
    SET contact_phone_key = r.target_key,
        contact_phone = COALESCE(c.phone_e164, r.target_key)
    FROM public.whatsapp_contacts c
    WHERE c.phone_key = r.target_key
      AND m.contact_phone_key = r.old_key;

    DELETE FROM public.whatsapp_contacts c
    WHERE c.phone_key = r.old_key
      AND NOT EXISTS (
        SELECT 1 FROM public.whatsapp_messages m WHERE m.contact_phone_key = r.old_key
      );

    PERFORM public.whatsapp_rebuild_contact_summary(r.target_key);
  END LOOP;
END $$;

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

UPDATE public.whatsapp_contacts c
SET name = derived.best_name,
    profile_pic_url = COALESCE(c.profile_pic_url, derived.best_photo),
    updated_at = now()
FROM (
  SELECT DISTINCT ON (contact_phone_key)
    contact_phone_key,
    NULLIF(raw->>'chatName', '') AS best_name,
    NULLIF(raw->>'photo', '') AS best_photo
  FROM public.whatsapp_messages
  WHERE direction = 'in'
    AND contact_phone_key IS NOT NULL
    AND NULLIF(raw->>'chatName', '') IS NOT NULL
    AND lower(NULLIF(raw->>'chatName', '')) NOT IN ('uau digital', 'uau digital ')
  ORDER BY contact_phone_key, created_at DESC
) derived
WHERE c.phone_key = derived.contact_phone_key
  AND c.origin <> 'grupo'
  AND c.user_id IS NULL
  AND derived.best_name IS NOT NULL
  AND (
    c.name IS NULL
    OR c.name ~ '^[0-9@._ -]+$'
    OR lower(c.name) LIKE 'uau digital%'
  );

UPDATE public.whatsapp_contacts c
SET name = tm.display_name,
    profile_pic_url = COALESCE(c.profile_pic_url, tm.avatar_url),
    updated_at = now()
FROM public.team_members tm
WHERE c.user_id = tm.user_id
  AND (c.name IS NULL OR lower(c.name) LIKE 'uau digital%' OR c.name ~ '^[0-9@._ -]+$');

DELETE FROM public.whatsapp_contacts c
WHERE c.phone_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.whatsapp_messages m WHERE m.contact_phone_key = c.phone_key
  )
  AND c.last_message_at IS NULL;