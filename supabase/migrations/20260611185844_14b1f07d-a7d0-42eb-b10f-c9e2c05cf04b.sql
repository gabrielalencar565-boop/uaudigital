CREATE OR REPLACE FUNCTION public.whatsapp_phone_key(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(RIGHT(regexp_replace(COALESCE(_phone, ''), '\D', '', 'g'), 10), '')
$$;

ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS phone_key text;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS contact_phone_key text;

CREATE INDEX IF NOT EXISTS whatsapp_contacts_phone_key_idx
  ON public.whatsapp_contacts (phone_key);

CREATE INDEX IF NOT EXISTS whatsapp_messages_phone_key_created_idx
  ON public.whatsapp_messages (contact_phone_key, created_at ASC);

CREATE OR REPLACE FUNCTION public.whatsapp_messages_set_phone_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.contact_phone := regexp_replace(COALESCE(NEW.contact_phone, ''), '\D', '', 'g');
  NEW.contact_phone_key := public.whatsapp_phone_key(NEW.contact_phone);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS whatsapp_messages_set_phone_key_tr ON public.whatsapp_messages;
CREATE TRIGGER whatsapp_messages_set_phone_key_tr
  BEFORE INSERT OR UPDATE OF contact_phone ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_messages_set_phone_key();

CREATE OR REPLACE FUNCTION public.whatsapp_contacts_set_phone_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.phone_e164 := regexp_replace(COALESCE(NEW.phone_e164, ''), '\D', '', 'g');
  NEW.phone_key := public.whatsapp_phone_key(NEW.phone_e164);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS whatsapp_contacts_set_phone_key_tr ON public.whatsapp_contacts;
CREATE TRIGGER whatsapp_contacts_set_phone_key_tr
  BEFORE INSERT OR UPDATE OF phone_e164 ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_contacts_set_phone_key();

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
  v_contact_phone text;
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

  SELECT phone_e164 INTO v_contact_phone
  FROM public.whatsapp_contacts
  WHERE phone_key = v_key
  ORDER BY last_message_at DESC NULLS LAST, created_at ASC
  LIMIT 1;

  INSERT INTO public.whatsapp_contacts (phone_e164, phone_key, origin, user_id, last_message_at, last_message_preview, unread_count)
  VALUES (
    COALESCE(v_contact_phone, v_phone), v_key, v_origin, v_user, NEW.created_at,
    LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
    CASE WHEN NEW.direction = 'in' THEN 1 ELSE 0 END
  )
  ON CONFLICT (phone_e164) DO UPDATE
    SET phone_key = v_key,
        last_message_at = NEW.created_at,
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