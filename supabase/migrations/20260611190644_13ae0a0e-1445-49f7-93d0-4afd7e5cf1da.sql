DROP INDEX IF EXISTS public.whatsapp_contacts_phone_key_unique_idx;

ALTER TABLE public.whatsapp_contacts
  DROP CONSTRAINT IF EXISTS whatsapp_contacts_phone_key_unique;
ALTER TABLE public.whatsapp_contacts
  ADD CONSTRAINT whatsapp_contacts_phone_key_unique UNIQUE (phone_key);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_contacts_user_id_unique_idx
  ON public.whatsapp_contacts (user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.whatsapp_messages_update_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text := regexp_replace(COALESCE(NEW.contact_phone, ''), '\D', '', 'g');
  v_key text := COALESCE(NEW.contact_phone_key, public.whatsapp_phone_key(NEW.contact_phone));
  v_user uuid;
  v_origin text;
BEGIN
  IF v_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user
  FROM public.user_whatsapp_preferences
  WHERE phone_e164 IS NOT NULL
    AND public.whatsapp_phone_key(phone_e164) = v_key
  LIMIT 1;

  v_origin := CASE WHEN v_user IS NOT NULL THEN 'colaborador' ELSE 'lead' END;

  INSERT INTO public.whatsapp_contacts (phone_e164, phone_key, origin, user_id, last_message_at, last_message_preview, unread_count)
  VALUES (
    v_phone, v_key, v_origin, v_user, NEW.created_at,
    LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
    CASE WHEN NEW.direction = 'in' THEN 1 ELSE 0 END
  )
  ON CONFLICT (phone_key) DO UPDATE
    SET last_message_at = NEW.created_at,
        last_message_preview = LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
        unread_count = CASE WHEN NEW.direction = 'in'
          THEN public.whatsapp_contacts.unread_count + 1
          ELSE public.whatsapp_contacts.unread_count END,
        user_id = COALESCE(public.whatsapp_contacts.user_id, v_user),
        origin = CASE
          WHEN v_user IS NOT NULL THEN 'colaborador'
          WHEN public.whatsapp_contacts.origin IN ('desconhecido','cliente') THEN 'lead'
          ELSE public.whatsapp_contacts.origin
        END,
        updated_at = now();

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.whatsapp_messages_update_contact() FROM PUBLIC, anon, authenticated;