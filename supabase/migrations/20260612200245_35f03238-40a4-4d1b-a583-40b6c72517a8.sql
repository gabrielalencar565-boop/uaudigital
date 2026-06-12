
-- Helper: detect "name" that is actually a phone number / digits
CREATE OR REPLACE FUNCTION public.crm_is_phoneish(_s text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT _s IS NULL
      OR btrim(_s) = ''
      OR btrim(_s) ~ '^[+0-9 ()\-]+$';
$$;

-- Update auto-create-lead trigger to avoid using phone as name
CREATE OR REPLACE FUNCTION public.crm_auto_create_lead_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text := COALESCE(NEW.contact_phone, '');
  v_is_group boolean := (position('-' in v_raw) > 0 OR v_raw LIKE '%@g.us');
  v_key text := COALESCE(NEW.contact_phone_key, public.whatsapp_phone_key(NEW.contact_phone));
  v_lead_id uuid;
  v_contact record;
  v_name text;
BEGIN
  IF NEW.direction <> 'in' THEN RETURN NEW; END IF;
  IF v_key IS NULL OR v_is_group THEN RETURN NEW; END IF;
  SELECT * INTO v_contact FROM public.whatsapp_contacts WHERE phone_key = v_key LIMIT 1;
  IF v_contact.user_id IS NOT NULL THEN RETURN NEW; END IF;

  v_name := NULLIF(btrim(COALESCE(v_contact.name, '')), '');
  IF v_name IS NULL OR public.crm_is_phoneish(v_name) THEN
    v_name := 'Novo lead';
  END IF;

  SELECT id INTO v_lead_id FROM public.crm_leads WHERE phone_key = v_key LIMIT 1;
  IF v_lead_id IS NULL THEN
    INSERT INTO public.crm_leads (nome, telefone, phone_key, origem, stage, whatsapp_contact_id, last_message_at)
    VALUES (v_name, v_raw, v_key, 'whatsapp', 'novo_lead', v_contact.id, NEW.created_at)
    RETURNING id INTO v_lead_id;
  ELSE
    UPDATE public.crm_leads SET last_message_at = NEW.created_at,
      whatsapp_contact_id = COALESCE(whatsapp_contact_id, v_contact.id),
      nome = CASE
        WHEN public.crm_is_phoneish(nome) AND NOT public.crm_is_phoneish(v_name) THEN v_name
        ELSE nome
      END
      WHERE id = v_lead_id;
  END IF;
  RETURN NEW;
END $$;

-- Render: do not use phone-ish names for {primeiro_nome}
CREATE OR REPLACE FUNCTION public.crm_render_welcome(_template text, _lead public.crm_leads)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := COALESCE(_template, '');
  v_first text;
BEGIN
  IF public.crm_is_phoneish(_lead.nome) THEN
    v_first := '';
  ELSE
    v_first := split_part(COALESCE(_lead.nome, ''), ' ', 1);
  END IF;
  v := replace(v, '{primeiro_nome}', COALESCE(NULLIF(v_first,''), 'tudo bem'));
  v := replace(v, '{nome_empresa}', COALESCE(NULLIF(_lead.empresa,''), 'sua empresa'));
  v := replace(v, '{origem}', COALESCE(NULLIF(_lead.origem,''), 'WhatsApp'));
  v := replace(v, '{servico_interesse}', COALESCE(NULLIF(_lead.interesse,''), 'nossos serviços'));
  RETURN v;
END;
$$;

-- Backfill: leads existentes salvos com o telefone no campo nome
UPDATE public.crm_leads l
SET nome = COALESCE(
  NULLIF(
    (SELECT btrim(c.name) FROM public.whatsapp_contacts c
      WHERE c.phone_key = l.phone_key
        AND c.name IS NOT NULL
        AND NOT public.crm_is_phoneish(c.name)
      LIMIT 1),
    ''
  ),
  'Novo lead'
)
WHERE public.crm_is_phoneish(l.nome);
