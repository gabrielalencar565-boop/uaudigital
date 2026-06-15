DO $$
DECLARE
  g record;
  old_key text;
BEGIN
  FOR g IN
    WITH normalized AS (
      SELECT
        c.*,
        public.whatsapp_phone_key(c.phone_e164) AS normalized_key
      FROM public.whatsapp_contacts c
      WHERE c.phone_key IS NOT NULL
        AND public.whatsapp_phone_key(c.phone_e164) IS NOT NULL
    ), groups AS (
      SELECT normalized_key
      FROM normalized
      GROUP BY normalized_key
      HAVING count(*) > 1
    ), choices AS (
      SELECT
        n.normalized_key,
        (array_agg(n.id ORDER BY CASE WHEN n.phone_key = n.normalized_key THEN 0 ELSE 1 END, n.last_message_at DESC NULLS LAST, n.updated_at DESC NULLS LAST))[1] AS keeper_id,
        (array_agg(n.id ORDER BY CASE WHEN n.user_id IS NOT NULL OR n.origin = 'colaborador' THEN 0 ELSE 1 END, n.last_message_at DESC NULLS LAST, n.updated_at DESC NULLS LAST))[1] AS preferred_id,
        array_agg(n.phone_key) AS all_keys
      FROM normalized n
      JOIN groups gr ON gr.normalized_key = n.normalized_key
      GROUP BY n.normalized_key
    )
    SELECT
      ch.normalized_key,
      ch.keeper_id,
      ch.preferred_id,
      ch.all_keys,
      pref.phone_e164 AS preferred_phone,
      pref.name AS preferred_name,
      pref.origin AS preferred_origin,
      pref.user_id AS preferred_user_id,
      pref.profile_pic_url AS preferred_profile_pic_url
    FROM choices ch
    JOIN public.whatsapp_contacts pref ON pref.id = ch.preferred_id
  LOOP
    FOREACH old_key IN ARRAY g.all_keys LOOP
      UPDATE public.whatsapp_messages m
      SET contact_phone = COALESCE(g.preferred_phone, m.contact_phone),
          contact_phone_key = g.normalized_key
      WHERE m.contact_phone_key = old_key;
    END LOOP;

    DELETE FROM public.whatsapp_contacts c
    WHERE c.id <> g.keeper_id
      AND c.phone_key = ANY(g.all_keys)
      AND NOT EXISTS (
        SELECT 1 FROM public.whatsapp_messages m WHERE m.contact_phone_key = c.phone_key
      );

    UPDATE public.whatsapp_contacts c
    SET phone_e164 = COALESCE(g.preferred_phone, c.phone_e164),
        phone_key = g.normalized_key,
        name = COALESCE(NULLIF(g.preferred_name, ''), c.name),
        origin = CASE WHEN g.preferred_user_id IS NOT NULL THEN 'colaborador' ELSE COALESCE(g.preferred_origin, c.origin) END,
        user_id = COALESCE(g.preferred_user_id, c.user_id),
        profile_pic_url = COALESCE(g.preferred_profile_pic_url, c.profile_pic_url),
        updated_at = now()
    WHERE c.id = g.keeper_id;

    PERFORM public.whatsapp_rebuild_contact_summary(g.normalized_key);
  END LOOP;
END $$;

UPDATE public.whatsapp_contacts
SET origin = 'colaborador',
    updated_at = now()
WHERE user_id IS NOT NULL
  AND origin IS DISTINCT FROM 'colaborador';

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