
-- 1) Add profile pic column
ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS profile_pic_url text;

-- 2) Allow 'lead' as default; relax check to include current values
ALTER TABLE public.whatsapp_contacts DROP CONSTRAINT IF EXISTS whatsapp_contacts_origin_check;
ALTER TABLE public.whatsapp_contacts
  ADD CONSTRAINT whatsapp_contacts_origin_check
  CHECK (origin IN ('colaborador','lead','cliente','desconhecido'));

-- 3) Backfill: desconhecido sem user_id -> lead
UPDATE public.whatsapp_contacts
SET origin = 'lead'
WHERE origin = 'desconhecido' AND user_id IS NULL;

-- 4) Backfill: number matches a collaborator's preference -> colaborador + user_id
UPDATE public.whatsapp_contacts c
SET origin = 'colaborador', user_id = p.user_id
FROM public.user_whatsapp_preferences p
WHERE p.phone_e164 IS NOT NULL
  AND regexp_replace(p.phone_e164,'\D','','g') = c.phone_e164
  AND (c.user_id IS NULL OR c.origin <> 'colaborador');

-- 5) Trigger: default origin agora é 'lead' quando não há vínculo
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
BEGIN
  SELECT user_id INTO v_user
  FROM public.user_whatsapp_preferences
  WHERE regexp_replace(COALESCE(phone_e164,''),'\D','','g') = v_phone
  LIMIT 1;

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

-- 6) Helper: manual link by admin
CREATE OR REPLACE FUNCTION public.whatsapp_link_contact_to_user(_phone text, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text := regexp_replace(COALESCE(_phone,''),'\D','','g');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  IF v_phone = '' THEN RAISE EXCEPTION 'Telefone inválido'; END IF;

  UPDATE public.whatsapp_contacts
  SET user_id = _user_id,
      origin = CASE WHEN _user_id IS NULL THEN 'lead' ELSE 'colaborador' END,
      updated_at = now()
  WHERE phone_e164 = v_phone;
END;
$$;

GRANT EXECUTE ON FUNCTION public.whatsapp_link_contact_to_user(text, uuid) TO authenticated;
