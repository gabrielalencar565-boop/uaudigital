
-- Enable pg_net and pg_cron (idempotent) for HTTP calls from the database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 1) whatsapp_settings (singleton row, id=1)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.whatsapp_provider AS ENUM ('evolution', 'zapi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id              integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled         boolean NOT NULL DEFAULT false,
  provider        public.whatsapp_provider NOT NULL DEFAULT 'evolution',
  base_url        text,                       -- e.g. https://evo.minhaempresa.com
  instance_name   text,                       -- Evolution instance name OR Z-API instance ID
  api_key_secret  text NOT NULL DEFAULT 'WHATSAPP_API_KEY', -- Edge-function env var holding the key
  zapi_client_token_secret text DEFAULT 'WHATSAPP_ZAPI_CLIENT_TOKEN', -- only used by Z-API
  default_country_code text NOT NULL DEFAULT '55',
  updated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.whatsapp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.whatsapp_settings TO authenticated;
GRANT ALL ON public.whatsapp_settings TO service_role;

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_settings_admin_read
  ON public.whatsapp_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY whatsapp_settings_admin_update
  ON public.whatsapp_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 2) user_whatsapp_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_whatsapp_preferences (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164       text,                          -- digits-only E.164 (no + sign), e.g. 5511999998888
  enabled          boolean NOT NULL DEFAULT true, -- master switch
  notify_new_task  boolean NOT NULL DEFAULT true,
  notify_deadline  boolean NOT NULL DEFAULT true,
  notify_company   boolean NOT NULL DEFAULT true,
  notify_xp_rank   boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_whatsapp_preferences TO authenticated;
GRANT ALL ON public.user_whatsapp_preferences TO service_role;

ALTER TABLE public.user_whatsapp_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY uwp_self_read
  ON public.user_whatsapp_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY uwp_self_upsert
  ON public.user_whatsapp_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY uwp_self_update
  ON public.user_whatsapp_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY uwp_admin_delete
  ON public.user_whatsapp_preferences FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER uwp_updated_at
  BEFORE UPDATE ON public.user_whatsapp_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) whatsapp_send_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_send_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_e164    text,
  notification_type text NOT NULL, -- 'new_task' | 'deadline' | 'company' | 'xp_rank' | 'manual'
  message       text NOT NULL,
  status        text NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed' | 'skipped'
  provider      public.whatsapp_provider,
  provider_response jsonb,
  error_message text,
  source_ref    text,            -- optional ref (e.g. pm_task id)
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz
);

CREATE INDEX IF NOT EXISTS whatsapp_send_log_created_at_idx ON public.whatsapp_send_log (created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_send_log_user_idx       ON public.whatsapp_send_log (user_id);

GRANT SELECT ON public.whatsapp_send_log TO authenticated;
GRANT ALL ON public.whatsapp_send_log TO service_role;

ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_send_log_self_read
  ON public.whatsapp_send_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 4) whatsapp_outbox (fila para envio em tempo real)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  message       text NOT NULL,
  source_ref    text,
  status        text NOT NULL DEFAULT 'queued', -- 'queued' | 'processing' | 'done' | 'failed'
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS whatsapp_outbox_status_idx ON public.whatsapp_outbox (status, created_at);

GRANT SELECT ON public.whatsapp_outbox TO authenticated;
GRANT ALL ON public.whatsapp_outbox TO service_role;

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_outbox_admin_read
  ON public.whatsapp_outbox FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 5) Helper: enqueue a WhatsApp notification (used by triggers)
-- ============================================================
CREATE OR REPLACE FUNCTION public.whatsapp_enqueue(
  _user_id uuid,
  _type    text,
  _message text,
  _source_ref text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_pref RECORD;
  v_settings RECORD;
  v_allowed boolean := true;
BEGIN
  IF _user_id IS NULL OR _type IS NULL OR _message IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_settings FROM public.whatsapp_settings WHERE id = 1;
  IF v_settings IS NULL OR v_settings.enabled = false THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_pref FROM public.user_whatsapp_preferences WHERE user_id = _user_id;
  IF v_pref IS NULL OR v_pref.enabled = false OR v_pref.phone_e164 IS NULL THEN
    RETURN NULL;
  END IF;

  v_allowed := CASE _type
    WHEN 'new_task' THEN v_pref.notify_new_task
    WHEN 'deadline' THEN v_pref.notify_deadline
    WHEN 'company'  THEN v_pref.notify_company
    WHEN 'xp_rank'  THEN v_pref.notify_xp_rank
    ELSE true
  END;
  IF NOT v_allowed THEN RETURN NULL; END IF;

  INSERT INTO public.whatsapp_outbox (user_id, notification_type, message, source_ref)
  VALUES (_user_id, _type, _message, _source_ref)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.whatsapp_enqueue(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.whatsapp_enqueue(uuid, text, text, text) TO service_role;

-- ============================================================
-- 6) Trigger: enqueue WhatsApp notification when a pm_task is
--    assigned (insert with assignee_id or assignee_id change).
-- ============================================================
CREATE OR REPLACE FUNCTION public.pm_tasks_whatsapp_notify_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should boolean := false;
  v_target uuid;
  v_client_name text;
  v_due text;
  v_msg text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_should := true;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
      v_should := true;
    END IF;
  END IF;

  IF NOT v_should THEN RETURN NEW; END IF;

  v_target := NEW.assignee_id;

  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  v_due := COALESCE(to_char(NEW.due_date, 'DD/MM/YYYY'), 'sem prazo');

  v_msg := '🆕 Nova tarefa atribuída: ' || COALESCE(NEW.title, 'sem título')
        || E'\nCliente: ' || COALESCE(v_client_name, '—')
        || E'\nPrazo: ' || v_due;

  PERFORM public.whatsapp_enqueue(v_target, 'new_task', v_msg, NEW.id::text);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pm_tasks_whatsapp_assignee ON public.pm_tasks;
CREATE TRIGGER pm_tasks_whatsapp_assignee
  AFTER INSERT OR UPDATE OF assignee_id ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.pm_tasks_whatsapp_notify_assignee();

-- Enable Realtime for the outbox so the dispatcher edge function (or a
-- listening client) can react instantly to new queued messages.
ALTER TABLE public.whatsapp_outbox REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_outbox;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
