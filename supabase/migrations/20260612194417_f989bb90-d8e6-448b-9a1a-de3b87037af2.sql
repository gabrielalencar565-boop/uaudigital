
-- 1. Add columns to crm_leads
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_scenario text;

-- 2. Automations config table (one row per scenario)
CREATE TABLE IF NOT EXISTS public.crm_lead_automations (
  scenario text PRIMARY KEY CHECK (scenario IN ('padrao','instagram','orcamento','fora_horario')),
  enabled boolean NOT NULL DEFAULT true,
  message_template text NOT NULL,
  cooldown_days int NOT NULL DEFAULT 30,
  followup_minutes int NOT NULL DEFAULT 10,
  business_hours_start time NOT NULL DEFAULT '09:00',
  business_hours_end time NOT NULL DEFAULT '18:00',
  business_days int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_automations TO authenticated;
GRANT ALL ON public.crm_lead_automations TO service_role;

ALTER TABLE public.crm_lead_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage crm_lead_automations" ON public.crm_lead_automations;
CREATE POLICY "Admins manage crm_lead_automations" ON public.crm_lead_automations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_crm_lead_automations_updated_at
  BEFORE UPDATE ON public.crm_lead_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Welcome log (for cooldown)
CREATE TABLE IF NOT EXISTS public.crm_lead_welcome_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  phone_key text NOT NULL,
  scenario text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_lead_welcome_log_phone_sent ON public.crm_lead_welcome_log(phone_key, sent_at DESC);

GRANT SELECT, INSERT ON public.crm_lead_welcome_log TO authenticated;
GRANT ALL ON public.crm_lead_welcome_log TO service_role;

ALTER TABLE public.crm_lead_welcome_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read welcome log" ON public.crm_lead_welcome_log;
CREATE POLICY "Admins read welcome log" ON public.crm_lead_welcome_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Seed defaults
INSERT INTO public.crm_lead_automations (scenario, enabled, message_template) VALUES
  ('padrao', true, 'Olá {primeiro_nome}! 👋 Aqui é da UAU Digital. Recebemos sua mensagem e em instantes um especialista vai te responder. Enquanto isso, pode me contar rapidamente qual serviço te interessa?'),
  ('instagram', true, 'Oi {primeiro_nome}! 💜 Vimos que você veio pelo Instagram. Que bom ter você por aqui! Me conta: o que despertou seu interesse na UAU?'),
  ('orcamento', true, 'Olá {primeiro_nome}! Recebi seu pedido de orçamento. Para preparar a melhor proposta, me conta um pouco sobre {nome_empresa} e qual serviço você busca?'),
  ('fora_horario', true, 'Olá {primeiro_nome}! Recebemos sua mensagem fora do nosso horário comercial. Amanhã pela manhã um consultor vai te responder com prioridade. 💜')
ON CONFLICT (scenario) DO NOTHING;

-- 5. Decision function: returns scenario name or NULL
CREATE OR REPLACE FUNCTION public.crm_should_send_welcome(_lead_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.crm_leads%ROWTYPE;
  v_phone_key text;
  v_origem text;
  v_contact_origin text;
  v_contact_user uuid;
  v_last_in_body text;
  v_last_in_at timestamptz;
  v_manual_recent boolean;
  v_cfg_fora public.crm_lead_automations%ROWTYPE;
  v_now_local timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_dow int;
  v_time time;
  v_scenario text;
  v_enabled boolean;
  v_cooldown_days int;
  v_recent boolean;
BEGIN
  SELECT * INTO v_lead FROM public.crm_leads WHERE id = _lead_id;
  IF v_lead.id IS NULL THEN RETURN NULL; END IF;
  IF v_lead.welcome_sent_at IS NOT NULL THEN RETURN NULL; END IF;
  IF v_lead.stage IN ('perdido','fechado') THEN RETURN NULL; END IF;

  v_phone_key := v_lead.phone_key;
  IF v_phone_key IS NULL THEN RETURN NULL; END IF;

  -- skip equipe / cliente / fornecedor
  SELECT origin, user_id INTO v_contact_origin, v_contact_user
  FROM public.whatsapp_contacts WHERE phone_key = v_phone_key LIMIT 1;
  IF v_contact_user IS NOT NULL THEN RETURN NULL; END IF;
  IF v_contact_origin IN ('colaborador','cliente','fornecedor','grupo') THEN RETURN NULL; END IF;

  -- atendimento manual recente (humano enviou mensagem fora de notificação)
  SELECT EXISTS (
    SELECT 1 FROM public.whatsapp_messages
    WHERE contact_phone_key = v_phone_key
      AND direction = 'out'
      AND source_type IN ('manual')
      AND created_at > now() - interval '60 minutes'
  ) INTO v_manual_recent;
  IF v_manual_recent THEN RETURN NULL; END IF;

  -- última mensagem recebida (para detecção de cenário)
  SELECT body, created_at INTO v_last_in_body, v_last_in_at
  FROM public.whatsapp_messages
  WHERE contact_phone_key = v_phone_key AND direction = 'in'
  ORDER BY created_at DESC LIMIT 1;

  v_origem := lower(COALESCE(v_lead.origem, ''));

  -- cenário: fora_horario > orcamento > instagram > padrao
  SELECT * INTO v_cfg_fora FROM public.crm_lead_automations WHERE scenario = 'fora_horario';
  v_dow := EXTRACT(ISODOW FROM v_now_local)::int; -- 1..7
  v_time := v_now_local::time;

  IF v_cfg_fora.enabled AND (
    NOT (v_dow = ANY(v_cfg_fora.business_days))
    OR v_time < v_cfg_fora.business_hours_start
    OR v_time >= v_cfg_fora.business_hours_end
  ) THEN
    v_scenario := 'fora_horario';
  ELSIF v_last_in_body IS NOT NULL AND v_last_in_body ~* '(orç|orcamento|preç|valor|quanto custa|investimento)' THEN
    v_scenario := 'orcamento';
  ELSIF v_origem = 'instagram'
        OR (v_last_in_body IS NOT NULL AND v_last_in_body ~* '(instagram|insta|\big\b|direct)') THEN
    v_scenario := 'instagram';
  ELSE
    v_scenario := 'padrao';
  END IF;

  SELECT enabled, cooldown_days INTO v_enabled, v_cooldown_days
  FROM public.crm_lead_automations WHERE scenario = v_scenario;
  IF NOT COALESCE(v_enabled, false) THEN RETURN NULL; END IF;

  -- cooldown por contato
  SELECT EXISTS (
    SELECT 1 FROM public.crm_lead_welcome_log
    WHERE phone_key = v_phone_key
      AND sent_at > now() - make_interval(days => GREATEST(COALESCE(v_cooldown_days,30),0))
  ) INTO v_recent;
  IF v_recent THEN RETURN NULL; END IF;

  RETURN v_scenario;
END;
$$;

-- 6. Render template
CREATE OR REPLACE FUNCTION public.crm_render_welcome(_template text, _lead public.crm_leads)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := COALESCE(_template, '');
  v_first text;
BEGIN
  v_first := split_part(COALESCE(_lead.nome, ''), ' ', 1);
  v := replace(v, '{primeiro_nome}', COALESCE(NULLIF(v_first,''), 'tudo bem'));
  v := replace(v, '{nome_empresa}', COALESCE(NULLIF(_lead.empresa,''), 'sua empresa'));
  v := replace(v, '{origem}', COALESCE(NULLIF(_lead.origem,''), 'WhatsApp'));
  v := replace(v, '{servico_interesse}', COALESCE(NULLIF(_lead.interesse,''), 'nossos serviços'));
  RETURN v;
END;
$$;

-- 7. AFTER INSERT trigger on crm_leads
CREATE OR REPLACE FUNCTION public.crm_leads_after_insert_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scenario text;
  v_cfg public.crm_lead_automations%ROWTYPE;
  v_msg text;
  v_phone text;
  v_resp uuid;
  v_followup int;
BEGIN
  IF NEW.telefone IS NULL THEN RETURN NEW; END IF;

  v_scenario := public.crm_should_send_welcome(NEW.id);
  IF v_scenario IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_cfg FROM public.crm_lead_automations WHERE scenario = v_scenario;
  v_msg := public.crm_render_welcome(v_cfg.message_template, NEW);
  v_phone := regexp_replace(NEW.telefone, '\D', '', 'g');
  IF v_phone = '' THEN RETURN NEW; END IF;
  v_followup := COALESCE(v_cfg.followup_minutes, 10);

  -- enqueue WhatsApp
  INSERT INTO public.whatsapp_outbox (notification_type, message, target_phone, source_ref, status)
  VALUES ('crm_welcome:' || v_scenario, v_msg, v_phone, 'crm_lead:' || NEW.id::text, 'queued');

  -- log + mark
  INSERT INTO public.crm_lead_welcome_log (lead_id, phone_key, scenario)
  VALUES (NEW.id, NEW.phone_key, v_scenario);

  UPDATE public.crm_leads
  SET welcome_sent_at = now(), welcome_scenario = v_scenario
  WHERE id = NEW.id;

  -- create follow-up task (10 min)
  v_resp := NEW.responsavel_id;
  IF v_resp IS NULL THEN
    SELECT user_id INTO v_resp FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  END IF;

  INSERT INTO public.crm_tasks (lead_id, tipo, titulo, descricao, due_at, assigned_user_id, created_by)
  VALUES (
    NEW.id, 'follow_up'::public.crm_task_type,
    'Responder lead em até ' || v_followup || ' min',
    'Mensagem automática (' || v_scenario || ') enviada. Responder o quanto antes para não esfriar.',
    now() + make_interval(mins => v_followup),
    v_resp, v_resp
  );

  -- trigger immediate processing (best-effort)
  BEGIN
    PERFORM net.http_post(
      url := 'https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/whatsapp-dispatch',
      headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6enViempic2p3dXZjaHVoa2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODE5NDcsImV4cCI6MjEwMDU1Nzk0N30.KlznJ82oOa7DSXDNDZBdzoPhwYTSdP6X6cOzLWM2Q24"}'::jsonb,
      body := '{"action":"process_outbox","limit":5}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_leads_after_insert_welcome ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_after_insert_welcome
  AFTER INSERT ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_leads_after_insert_welcome();
