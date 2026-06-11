CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_contacts_phone_key_unique_idx
  ON public.whatsapp_contacts (phone_key)
  WHERE phone_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.whatsapp_rebuild_contact_summary(_phone_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_link_contact_to_user(_phone text, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text := regexp_replace(COALESCE(_phone,''),'\D','','g');
  v_key text := public.whatsapp_phone_key(_phone);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  IF v_key IS NULL THEN RAISE EXCEPTION 'Telefone inválido'; END IF;

  UPDATE public.whatsapp_contacts
  SET user_id = _user_id,
      origin = CASE WHEN _user_id IS NULL THEN 'lead' ELSE 'colaborador' END,
      phone_key = v_key,
      updated_at = now()
  WHERE phone_key = v_key OR phone_e164 = v_phone;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.whatsapp_link_contact_to_user(text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.whatsapp_rebuild_contact_summary(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_rebuild_contact_summary(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.whatsapp_messages_set_phone_key() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.whatsapp_contacts_set_phone_key() FROM anon, authenticated;