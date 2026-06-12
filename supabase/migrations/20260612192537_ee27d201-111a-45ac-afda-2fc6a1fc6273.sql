
-- ENUMS
DO $$ BEGIN CREATE TYPE public.crm_stage AS ENUM ('novo_lead','primeiro_contato','qualificacao','diagnostico','proposta_enviada','follow_up','fechado','perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.crm_loss_reason AS ENUM ('preco','sem_retorno','concorrente','sem_orcamento','nao_era_momento','sem_perfil');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.crm_task_type AS ENUM ('ligacao','proposta','follow_up','reuniao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.crm_task_status AS ENUM ('pendente','concluida','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.crm_proposal_status AS ENUM ('rascunho','enviada','aceita','recusada','expirada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.crm_urgencia AS ENUM ('baixa','media','alta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.crm_potencial AS ENUM ('baixo','medio','alto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  phone_key text,
  empresa text,
  cidade text,
  segmento text,
  interesse text,
  origem text,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stage public.crm_stage NOT NULL DEFAULT 'novo_lead',
  stage_changed_at timestamptz NOT NULL DEFAULT now(),
  valor_estimado numeric(12,2),
  observacoes text,
  loss_reason public.crm_loss_reason,
  ja_investe_marketing boolean,
  orcamento_aproximado numeric(12,2),
  principal_problema text,
  urgencia public.crm_urgencia,
  nivel_interesse smallint CHECK (nivel_interesse IS NULL OR (nivel_interesse BETWEEN 1 AND 5)),
  potencial_fechamento public.crm_potencial,
  whatsapp_contact_id uuid,
  last_message_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON public.crm_leads(stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_responsavel ON public.crm_leads(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone_key ON public.crm_leads(phone_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_leads_phone_key ON public.crm_leads(phone_key) WHERE phone_key IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage leads" ON public.crm_leads;
CREATE POLICY "Admins manage leads" ON public.crm_leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  tipo public.crm_task_type NOT NULL,
  titulo text NOT NULL,
  descricao text,
  due_at timestamptz,
  status public.crm_task_status NOT NULL DEFAULT 'pendente',
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead ON public.crm_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON public.crm_tasks(due_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage crm tasks" ON public.crm_tasks;
CREATE POLICY "Admins manage crm tasks" ON public.crm_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.crm_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  valor numeric(12,2),
  enviada_em timestamptz,
  status public.crm_proposal_status NOT NULL DEFAULT 'rascunho',
  arquivo_url text,
  arquivo_nome text,
  resultado text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_proposals_lead ON public.crm_proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_proposals_status ON public.crm_proposals(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_proposals TO authenticated;
GRANT ALL ON public.crm_proposals TO service_role;
ALTER TABLE public.crm_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage crm proposals" ON public.crm_proposals;
CREATE POLICY "Admins manage crm proposals" ON public.crm_proposals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.crm_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_activity_lead ON public.crm_activity_log(lead_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activity_log TO authenticated;
GRANT ALL ON public.crm_activity_log TO service_role;
ALTER TABLE public.crm_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage crm activity" ON public.crm_activity_log;
CREATE POLICY "Admins manage crm activity" ON public.crm_activity_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_crm_leads_updated_at ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_crm_tasks_updated_at ON public.crm_tasks;
CREATE TRIGGER trg_crm_tasks_updated_at BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_crm_proposals_updated_at ON public.crm_proposals;
CREATE TRIGGER trg_crm_proposals_updated_at BEFORE UPDATE ON public.crm_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.crm_leads_before_save()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.telefone IS NOT NULL THEN
    NEW.phone_key := public.whatsapp_phone_key(NEW.telefone);
  END IF;
  IF NEW.stage = 'perdido' AND NEW.loss_reason IS NULL THEN
    RAISE EXCEPTION 'Motivo de perda obrigatório quando a etapa é Perdido';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_leads_before_save ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_before_save BEFORE INSERT OR UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_leads_before_save();

CREATE OR REPLACE FUNCTION public.crm_leads_log_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crm_activity_log(lead_id, user_id, action, payload)
    VALUES (NEW.id, auth.uid(), 'created', jsonb_build_object('stage', NEW.stage));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
      INSERT INTO public.crm_activity_log(lead_id, user_id, action, payload)
      VALUES (NEW.id, auth.uid(), 'stage_changed',
              jsonb_build_object('from', OLD.stage, 'to', NEW.stage, 'loss_reason', NEW.loss_reason));
    END IF;
    IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
      INSERT INTO public.crm_activity_log(lead_id, user_id, action, payload)
      VALUES (NEW.id, auth.uid(), 'responsavel_changed',
              jsonb_build_object('from', OLD.responsavel_id, 'to', NEW.responsavel_id));
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_leads_log_activity ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_log_activity AFTER INSERT OR UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_leads_log_activity();

CREATE OR REPLACE FUNCTION public.crm_auto_create_lead_from_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_raw text := COALESCE(NEW.contact_phone, '');
  v_is_group boolean := (position('-' in v_raw) > 0 OR v_raw LIKE '%@g.us');
  v_key text := COALESCE(NEW.contact_phone_key, public.whatsapp_phone_key(NEW.contact_phone));
  v_lead_id uuid;
  v_contact record;
BEGIN
  IF NEW.direction <> 'in' THEN RETURN NEW; END IF;
  IF v_key IS NULL OR v_is_group THEN RETURN NEW; END IF;
  SELECT * INTO v_contact FROM public.whatsapp_contacts WHERE phone_key = v_key LIMIT 1;
  IF v_contact.user_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_lead_id FROM public.crm_leads WHERE phone_key = v_key LIMIT 1;
  IF v_lead_id IS NULL THEN
    INSERT INTO public.crm_leads (nome, telefone, phone_key, origem, stage, whatsapp_contact_id, last_message_at)
    VALUES (COALESCE(NULLIF(v_contact.name, ''), v_raw), v_raw, v_key, 'whatsapp', 'novo_lead', v_contact.id, NEW.created_at)
    RETURNING id INTO v_lead_id;
  ELSE
    UPDATE public.crm_leads SET last_message_at = NEW.created_at,
      whatsapp_contact_id = COALESCE(whatsapp_contact_id, v_contact.id)
      WHERE id = v_lead_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_auto_create_lead ON public.whatsapp_messages;
CREATE TRIGGER trg_crm_auto_create_lead AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.crm_auto_create_lead_from_message();

INSERT INTO public.crm_leads (nome, telefone, phone_key, origem, stage, whatsapp_contact_id, last_message_at)
SELECT COALESCE(NULLIF(wc.name, ''), wc.phone_e164), wc.phone_e164, wc.phone_key, 'whatsapp', 'novo_lead', wc.id, wc.last_message_at
FROM public.whatsapp_contacts wc
WHERE wc.user_id IS NULL AND COALESCE(wc.origin,'') <> 'grupo' AND wc.phone_key IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.crm_leads cl WHERE cl.phone_key = wc.phone_key)
ON CONFLICT DO NOTHING;

ALTER TABLE public.crm_leads REPLICA IDENTITY FULL;
ALTER TABLE public.crm_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.crm_proposals REPLICA IDENTITY FULL;
ALTER TABLE public.crm_activity_log REPLICA IDENTITY FULL;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_proposals; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_activity_log; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
