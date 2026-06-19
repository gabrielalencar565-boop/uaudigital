
-- 1) Helper: valida nome humano
CREATE OR REPLACE FUNCTION public.is_valid_person_name(_name text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  IF _name IS NULL THEN RETURN false; END IF;
  v := lower(btrim(_name));
  IF v = '' THEN RETURN false; END IF;
  -- só dígitos / telefone
  IF v ~ '^[\+\d\s\-\(\)\.]+$' THEN RETURN false; END IF;
  -- termos genéricos (exatos ou começando com)
  IF v IN ('novo','novo lead','lead','novo contato','cliente','novo cliente',
           'contato','sem nome','desconhecido','unknown','anônimo','anonimo',
           'whatsapp','wpp','uau digital','uau') THEN
    RETURN false;
  END IF;
  IF v ~ '^(novo\s+lead|novo\s+contato|novo\s+cliente|sem\s+nome)\b' THEN
    RETURN false;
  END IF;
  RETURN true;
END; $$;

-- 2) Helper: extrai primeiro nome válido
CREATE OR REPLACE FUNCTION public.first_valid_name(VARIADIC _names text[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n text;
BEGIN
  IF _names IS NULL THEN RETURN NULL; END IF;
  FOREACH n IN ARRAY _names LOOP
    IF public.is_valid_person_name(n) THEN
      RETURN btrim(n);
    END IF;
  END LOOP;
  RETURN NULL;
END; $$;

-- 3) Renderer atualizado: prioriza nome do whatsapp_contacts, valida, e limpa template
CREATE OR REPLACE FUNCTION public.crm_render_welcome(_template text, _lead public.crm_leads)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v text := COALESCE(_template, '');
  v_wa_name text;
  v_full text;
  v_first text;
  v_empresa text;
BEGIN
  SELECT name INTO v_wa_name
  FROM public.whatsapp_contacts
  WHERE phone_key = _lead.phone_key
  LIMIT 1;

  v_full := public.first_valid_name(v_wa_name, _lead.nome);

  IF v_full IS NOT NULL THEN
    v_first := split_part(v_full, ' ', 1);
    IF NOT public.is_valid_person_name(v_first) THEN
      v_first := NULL;
    END IF;
  END IF;

  IF v_first IS NOT NULL AND v_first <> '' THEN
    v := replace(v, '{primeiro_nome}', v_first);
  ELSE
    -- Remove a variável + pontuação/espacos imediatamente em volta para evitar "Oi !" / "Oi ,"
    v := regexp_replace(v, '[\s,;:]*\{primeiro_nome\}[\s,;:]*', ' ', 'g');
    v := regexp_replace(v, '\s+([,.!?;:])', '\1', 'g');
    v := regexp_replace(v, '\s{2,}', ' ', 'g');
    v := btrim(v);
  END IF;

  v_empresa := CASE WHEN public.is_valid_person_name(_lead.empresa) THEN _lead.empresa ELSE NULL END;
  v := replace(v, '{nome_empresa}', COALESCE(v_empresa, 'sua empresa'));
  v := replace(v, '{origem}', COALESCE(NULLIF(_lead.origem,''), 'WhatsApp'));
  v := replace(v, '{servico_interesse}', COALESCE(NULLIF(_lead.servico_interesse,''), 'nossos serviços'));

  RETURN v;
END; $$;

-- 4) Backfill: corrige leads cujo nome é genérico/telefone usando whatsapp_contacts.name
UPDATE public.crm_leads l
SET nome = c.name,
    updated_at = now()
FROM public.whatsapp_contacts c
WHERE c.phone_key = l.phone_key
  AND public.is_valid_person_name(c.name)
  AND NOT public.is_valid_person_name(l.nome);
