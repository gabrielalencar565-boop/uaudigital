
ALTER TABLE public.whatsapp_automations ADD COLUMN IF NOT EXISTS group_phone text;

ALTER TABLE public.whatsapp_outbox ADD COLUMN IF NOT EXISTS target_phone text;
ALTER TABLE public.whatsapp_outbox ALTER COLUMN user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.whatsapp_enqueue_phone(
  _phone text, _type text, _message text, _source_ref text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_settings record;
BEGIN
  IF _phone IS NULL OR length(trim(_phone)) = 0 OR _message IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_settings FROM public.whatsapp_settings WHERE id = 1;
  IF v_settings IS NULL OR v_settings.enabled = false THEN RETURN NULL; END IF;
  INSERT INTO public.whatsapp_outbox (user_id, target_phone, notification_type, message, source_ref, status)
  VALUES (NULL, _phone, _type, _message, _source_ref, 'queued')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.whatsapp_dispatch_event(
  _key text, _vars jsonb, _user_id uuid, _source_ref text DEFAULT NULL
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_auto record; v_msg text; v_count int := 0;
BEGIN
  FOR v_auto IN
    SELECT id, message_template, audience, group_phone
    FROM public.whatsapp_automations
    WHERE enabled = true AND trigger_type = 'event' AND trigger_key = _key
  LOOP
    v_msg := public.apply_msg_template(v_auto.message_template, _vars);
    IF v_msg IS NULL OR length(trim(v_msg)) = 0 THEN CONTINUE; END IF;
    IF v_auto.audience = 'group' THEN
      IF v_auto.group_phone IS NOT NULL AND length(trim(v_auto.group_phone)) > 0 THEN
        PERFORM public.whatsapp_enqueue_phone(v_auto.group_phone, _key, v_msg, _source_ref);
        v_count := v_count + 1;
      END IF;
    ELSE
      IF _user_id IS NOT NULL THEN
        PERFORM public.whatsapp_enqueue(_user_id, _key, v_msg, _source_ref);
        v_count := v_count + 1;
      END IF;
    END IF;
    UPDATE public.whatsapp_automations SET last_run_at = now() WHERE id = v_auto.id;
  END LOOP;
  RETURN v_count;
END $$;

ALTER TABLE public.whatsapp_contacts DROP CONSTRAINT IF EXISTS whatsapp_contacts_origin_check;
ALTER TABLE public.whatsapp_contacts
  ADD CONSTRAINT whatsapp_contacts_origin_check
  CHECK (origin = ANY (ARRAY['colaborador','lead','cliente','desconhecido','grupo']));

DROP FUNCTION IF EXISTS public.whatsapp_phone_key(text);
CREATE OR REPLACE FUNCTION public.whatsapp_phone_key(_raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  v := lower(trim(_raw));
  IF position('-' in v) > 0 OR v LIKE '%@g.us' THEN
    RETURN replace(v, '@g.us', '');
  END IF;
  v := regexp_replace(_raw, '\D', '', 'g');
  IF length(v) = 0 THEN RETURN NULL; END IF;
  RETURN right(v, 10);
END $$;

CREATE OR REPLACE FUNCTION public.whatsapp_messages_update_contact()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_raw text := COALESCE(NEW.contact_phone, '');
  v_is_group boolean := (position('-' in v_raw) > 0 OR v_raw LIKE '%@g.us');
  v_phone text := CASE WHEN v_is_group THEN replace(lower(trim(v_raw)), '@g.us', '')
                       ELSE regexp_replace(v_raw, '\D', '', 'g') END;
  v_key text := COALESCE(NEW.contact_phone_key, public.whatsapp_phone_key(NEW.contact_phone));
  v_user uuid;
  v_origin text;
BEGIN
  IF v_key IS NULL THEN RETURN NEW; END IF;
  IF v_is_group THEN
    v_origin := 'grupo'; v_user := NULL;
  ELSE
    SELECT user_id INTO v_user FROM public.user_whatsapp_preferences
    WHERE phone_e164 IS NOT NULL AND public.whatsapp_phone_key(phone_e164) = v_key
    LIMIT 1;
    v_origin := CASE WHEN v_user IS NOT NULL THEN 'colaborador' ELSE 'lead' END;
  END IF;
  INSERT INTO public.whatsapp_contacts (phone_e164, phone_key, origin, user_id, last_message_at, last_message_preview, unread_count)
  VALUES (v_phone, v_key, v_origin, v_user, NEW.created_at,
    LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
    CASE WHEN NEW.direction = 'in' THEN 1 ELSE 0 END)
  ON CONFLICT (phone_key) DO UPDATE
    SET last_message_at = NEW.created_at,
        last_message_preview = LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
        unread_count = CASE WHEN NEW.direction = 'in'
          THEN public.whatsapp_contacts.unread_count + 1
          ELSE public.whatsapp_contacts.unread_count END,
        user_id = COALESCE(public.whatsapp_contacts.user_id, v_user),
        origin = CASE
          WHEN v_is_group THEN 'grupo'
          WHEN public.whatsapp_contacts.origin = 'desconhecido' THEN v_origin
          ELSE public.whatsapp_contacts.origin
        END;
  RETURN NEW;
END $$;
