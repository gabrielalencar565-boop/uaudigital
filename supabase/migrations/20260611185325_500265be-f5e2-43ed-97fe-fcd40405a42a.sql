
-- Trigger: match by last 10 digits to handle country code variations
CREATE OR REPLACE FUNCTION public.whatsapp_messages_update_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text := NEW.contact_phone;
  v_user uuid;
  v_origin text;
  v_tail text := RIGHT(regexp_replace(COALESCE(v_phone,''),'\D','','g'), 10);
BEGIN
  IF length(v_tail) >= 8 THEN
    SELECT user_id INTO v_user
    FROM public.user_whatsapp_preferences
    WHERE phone_e164 IS NOT NULL
      AND RIGHT(regexp_replace(phone_e164,'\D','','g'), 10) = v_tail
    LIMIT 1;
  END IF;

  v_origin := CASE WHEN v_user IS NOT NULL THEN 'colaborador' ELSE 'lead' END;

  INSERT INTO public.whatsapp_contacts (phone_e164, origin, user_id, last_message_at, last_message_preview, unread_count)
  VALUES (
    v_phone, v_origin, v_user, NEW.created_at,
    LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
    CASE WHEN NEW.direction = 'in' THEN 1 ELSE 0 END
  )
  ON CONFLICT (phone_e164) DO UPDATE
    SET last_message_at = NEW.created_at,
        last_message_preview = LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
        unread_count = CASE WHEN NEW.direction = 'in'
          THEN public.whatsapp_contacts.unread_count + 1
          ELSE public.whatsapp_contacts.unread_count END,
        user_id = COALESCE(public.whatsapp_contacts.user_id, v_user),
        origin = CASE
          WHEN v_user IS NOT NULL AND public.whatsapp_contacts.origin <> 'cliente'
            THEN 'colaborador'
          WHEN public.whatsapp_contacts.origin = 'desconhecido' THEN v_origin
          ELSE public.whatsapp_contacts.origin
        END,
        updated_at = now();

  RETURN NEW;
END;
$function$;

-- Backfill existing contacts using the same last-10-digits rule
UPDATE public.whatsapp_contacts c
SET user_id = p.user_id,
    origin = 'colaborador',
    updated_at = now()
FROM public.user_whatsapp_preferences p
WHERE p.phone_e164 IS NOT NULL
  AND length(regexp_replace(c.phone_e164,'\D','','g')) >= 8
  AND RIGHT(regexp_replace(p.phone_e164,'\D','','g'), 10)
      = RIGHT(regexp_replace(c.phone_e164,'\D','','g'), 10)
  AND (c.user_id IS NULL OR c.user_id <> p.user_id);
