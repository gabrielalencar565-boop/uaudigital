
-- ============ whatsapp_contacts ============
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE,
  name text,
  origin text NOT NULL DEFAULT 'desconhecido' CHECK (origin IN ('colaborador','lead','cliente','desconhecido')),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','arquivado','bloqueado')),
  user_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contacts TO authenticated;
GRANT ALL ON public.whatsapp_contacts TO service_role;

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_contacts_admin_all"
  ON public.whatsapp_contacts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS whatsapp_contacts_last_msg_idx
  ON public.whatsapp_contacts (last_message_at DESC NULLS LAST);

CREATE TRIGGER whatsapp_contacts_set_updated
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ whatsapp_messages ============
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_phone text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  body text,
  media_url text,
  media_type text,
  zapi_message_id text,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('pending','sent','delivered','read','failed','received')),
  sent_by_user_id uuid,
  source_type text NOT NULL DEFAULT 'webhook'
    CHECK (source_type IN ('manual','notification','webhook','system')),
  source_ref text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_messages_admin_all"
  ON public.whatsapp_messages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS whatsapp_messages_phone_created_idx
  ON public.whatsapp_messages (contact_phone, created_at DESC);

-- ============ Trigger: keep contact summary ============
CREATE OR REPLACE FUNCTION public.whatsapp_messages_update_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := NEW.contact_phone;
  v_origin text := 'desconhecido';
  v_user uuid;
BEGIN
  -- Upsert contact
  SELECT user_id INTO v_user
  FROM public.user_whatsapp_preferences
  WHERE phone_e164 = v_phone
  LIMIT 1;
  IF v_user IS NOT NULL THEN v_origin := 'colaborador'; END IF;

  INSERT INTO public.whatsapp_contacts (phone_e164, origin, user_id, last_message_at, last_message_preview, unread_count)
  VALUES (
    v_phone,
    v_origin,
    v_user,
    NEW.created_at,
    LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
    CASE WHEN NEW.direction = 'in' THEN 1 ELSE 0 END
  )
  ON CONFLICT (phone_e164) DO UPDATE
    SET last_message_at = NEW.created_at,
        last_message_preview = LEFT(COALESCE(NEW.body, NEW.media_type, ''), 200),
        unread_count = CASE
          WHEN NEW.direction = 'in' THEN public.whatsapp_contacts.unread_count + 1
          ELSE public.whatsapp_contacts.unread_count
        END,
        user_id = COALESCE(public.whatsapp_contacts.user_id, v_user),
        origin = CASE
          WHEN public.whatsapp_contacts.origin = 'desconhecido' THEN v_origin
          ELSE public.whatsapp_contacts.origin
        END,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_messages_update_contact_tr ON public.whatsapp_messages;
CREATE TRIGGER whatsapp_messages_update_contact_tr
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_messages_update_contact();

-- ============ Realtime ============
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_contacts REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_contacts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
