
-- Improve auto-create lead function: skip groups properly, update placeholder names
CREATE OR REPLACE FUNCTION public.crm_auto_create_lead_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_raw text := COALESCE(NEW.contact_phone, '');
  v_digits text := regexp_replace(v_raw, '\D', '', 'g');
  v_is_group boolean := (
    position('-' in v_raw) > 0
    OR v_raw ILIKE '%@g.us'
    OR v_raw ILIKE '%-group'
    OR length(v_digits) > 15
  );
  v_key text := COALESCE(NEW.contact_phone_key, public.whatsapp_phone_key(NEW.contact_phone));
  v_lead_id uuid;
  v_contact record;
  v_name text;
  v_contact_name text;
BEGIN
  IF NEW.direction <> 'in' THEN RETURN NEW; END IF;
  IF v_key IS NULL OR v_is_group THEN RETURN NEW; END IF;

  SELECT * INTO v_contact FROM public.whatsapp_contacts WHERE phone_key = v_key LIMIT 1;
  IF v_contact.user_id IS NOT NULL THEN RETURN NEW; END IF;

  v_contact_name := NULLIF(btrim(COALESCE(v_contact.name, '')), '');
  IF v_contact_name IS NOT NULL
     AND lower(v_contact_name) = 'uau digital' THEN
    v_contact_name := NULL;
  END IF;
  IF v_contact_name IS NOT NULL AND public.crm_is_phoneish(v_contact_name) THEN
    v_contact_name := NULL;
  END IF;

  v_name := COALESCE(v_contact_name, 'Novo lead');

  SELECT id INTO v_lead_id FROM public.crm_leads WHERE phone_key = v_key LIMIT 1;
  IF v_lead_id IS NULL THEN
    INSERT INTO public.crm_leads (nome, telefone, phone_key, origem, stage, whatsapp_contact_id, last_message_at)
    VALUES (v_name, v_raw, v_key, 'whatsapp', 'novo_lead', v_contact.id, NEW.created_at)
    RETURNING id INTO v_lead_id;
  ELSE
    UPDATE public.crm_leads SET
      last_message_at = NEW.created_at,
      whatsapp_contact_id = COALESCE(whatsapp_contact_id, v_contact.id),
      nome = CASE
        WHEN v_contact_name IS NOT NULL
             AND (nome IS NULL OR nome = '' OR nome = 'Novo lead' OR public.crm_is_phoneish(nome))
          THEN v_contact_name
        ELSE nome
      END
    WHERE id = v_lead_id;
  END IF;
  RETURN NEW;
END $function$;
