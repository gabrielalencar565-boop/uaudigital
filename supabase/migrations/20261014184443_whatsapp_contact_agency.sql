-- O contato criado pela mensagem recebida (webhook, sem usuário logado) nascia sem agência e ficava invisível nas Conversas:
-- agora herda a agência da própria mensagem.
create or replace function public.whatsapp_messages_update_contact()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  INSERT INTO public.whatsapp_contacts (phone_e164, phone_key, origin, user_id, last_message_at, last_message_preview, unread_count, agency_id)
  VALUES (v_phone, v_key, v_origin, v_user, NEW.created_at,
    LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
    CASE WHEN NEW.direction = 'in' THEN 1 ELSE 0 END,
    COALESCE(NEW.agency_id, public.current_agency_id()))
  ON CONFLICT (phone_key) DO UPDATE
    SET last_message_at = NEW.created_at,
        last_message_preview = LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
        unread_count = CASE WHEN NEW.direction = 'in'
          THEN public.whatsapp_contacts.unread_count + 1
          ELSE public.whatsapp_contacts.unread_count END,
        user_id = COALESCE(public.whatsapp_contacts.user_id, v_user),
        agency_id = COALESCE(public.whatsapp_contacts.agency_id, NEW.agency_id),
        origin = CASE
          WHEN v_is_group THEN 'grupo'
          WHEN public.whatsapp_contacts.origin = 'desconhecido' THEN v_origin
          ELSE public.whatsapp_contacts.origin
        END;
  RETURN NEW;
END $function$;
