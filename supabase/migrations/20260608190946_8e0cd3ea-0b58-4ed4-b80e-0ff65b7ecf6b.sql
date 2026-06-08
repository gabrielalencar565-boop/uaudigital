
-- Types
CREATE TYPE public.chat_conversation_type AS ENUM ('general', 'direct');

-- Conversations
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.chat_conversation_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Participants
CREATE TABLE public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
CREATE INDEX idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX idx_chat_participants_conv ON public.chat_participants(conversation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_participants TO authenticated;
GRANT ALL ON public.chat_participants TO service_role;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- Messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_by uuid,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_conv_created ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Attachments
CREATE TABLE public.chat_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_attach_msg ON public.chat_message_attachments(message_id);
GRANT SELECT, INSERT, DELETE ON public.chat_message_attachments TO authenticated;
GRANT ALL ON public.chat_message_attachments TO service_role;
ALTER TABLE public.chat_message_attachments ENABLE ROW LEVEL SECURITY;

-- Reads
CREATE TABLE public.chat_message_reads (
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_chat_reads_user ON public.chat_message_reads(user_id);
GRANT SELECT, INSERT ON public.chat_message_reads TO authenticated;
GRANT ALL ON public.chat_message_reads TO service_role;
ALTER TABLE public.chat_message_reads ENABLE ROW LEVEL SECURITY;

-- Presence
CREATE TABLE public.chat_presence (
  user_id uuid PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.chat_presence TO authenticated;
GRANT ALL ON public.chat_presence TO service_role;
ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;

-- Mentions
CREATE TABLE public.chat_mentions (
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_chat_mentions_user ON public.chat_mentions(user_id);
GRANT SELECT, INSERT ON public.chat_mentions TO authenticated;
GRANT ALL ON public.chat_mentions TO service_role;
ALTER TABLE public.chat_mentions ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER, avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.chat_is_participant(_conv uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = _conv AND user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_conversation_type(_conv uuid)
RETURNS public.chat_conversation_type
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT type FROM public.chat_conversations WHERE id = _conv;
$$;

CREATE OR REPLACE FUNCTION public.chat_message_sender(_msg uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sender_id FROM public.chat_messages WHERE id = _msg;
$$;

CREATE OR REPLACE FUNCTION public.chat_message_conversation(_msg uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT conversation_id FROM public.chat_messages WHERE id = _msg;
$$;

-- Get or create direct conversation between current user and other
CREATE OR REPLACE FUNCTION public.chat_get_or_create_direct(_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other_user IS NULL OR _other_user = v_uid THEN
    RAISE EXCEPTION 'Invalid target user';
  END IF;

  SELECT c.id INTO v_conv
  FROM public.chat_conversations c
  JOIN public.chat_participants p1 ON p1.conversation_id = c.id AND p1.user_id = v_uid
  JOIN public.chat_participants p2 ON p2.conversation_id = c.id AND p2.user_id = _other_user
  WHERE c.type = 'direct'
  LIMIT 1;

  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;

  INSERT INTO public.chat_conversations (type) VALUES ('direct') RETURNING id INTO v_conv;
  INSERT INTO public.chat_participants (conversation_id, user_id) VALUES (v_conv, v_uid), (v_conv, _other_user);
  RETURN v_conv;
END;
$$;

-- Mark conversation as read
CREATE OR REPLACE FUNCTION public.chat_mark_read(_conv uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  UPDATE public.chat_participants
  SET last_read_at = now()
  WHERE conversation_id = _conv AND user_id = v_uid;

  INSERT INTO public.chat_message_reads (message_id, user_id)
  SELECT m.id, v_uid
  FROM public.chat_messages m
  WHERE m.conversation_id = _conv
    AND m.sender_id <> v_uid
  ON CONFLICT DO NOTHING;
END;
$$;

-- Auto-join all authenticated users to general chat
CREATE OR REPLACE FUNCTION public.chat_ensure_general_member()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_general uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_general FROM public.chat_conversations WHERE type = 'general' LIMIT 1;
  IF v_general IS NULL THEN
    INSERT INTO public.chat_conversations (type) VALUES ('general') RETURNING id INTO v_general;
  END IF;
  INSERT INTO public.chat_participants (conversation_id, user_id)
  VALUES (v_general, v_uid)
  ON CONFLICT DO NOTHING;
  RETURN v_general;
END;
$$;

-- Update updated_at on messages bump conversation
CREATE OR REPLACE FUNCTION public.chat_bump_conversation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.chat_conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_chat_bump_conv AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_bump_conversation();

-- Mentions extractor: parse @uuid tokens (we send them as @user:uuid in content)
-- (Client will create chat_mentions rows directly; no trigger needed.)

-- ============== RLS POLICIES ==============

-- Conversations
CREATE POLICY "chat_conv_select_general_or_participant"
ON public.chat_conversations FOR SELECT TO authenticated
USING (
  type = 'general'
  OR public.chat_is_participant(id, auth.uid())
);

-- Participants
CREATE POLICY "chat_part_select_own_or_general"
ON public.chat_participants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.chat_conversation_type(conversation_id) = 'general'
  OR public.chat_is_participant(conversation_id, auth.uid())
);

CREATE POLICY "chat_part_insert_self_general"
ON public.chat_participants FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.chat_conversation_type(conversation_id) = 'general'
);

CREATE POLICY "chat_part_update_own"
ON public.chat_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Messages
CREATE POLICY "chat_msg_select_visible"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  public.chat_conversation_type(conversation_id) = 'general'
  OR public.chat_is_participant(conversation_id, auth.uid())
);

CREATE POLICY "chat_msg_insert_participant"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.chat_conversation_type(conversation_id) = 'general'
    OR public.chat_is_participant(conversation_id, auth.uid())
  )
);

CREATE POLICY "chat_msg_update_own_or_admin"
ON public.chat_messages FOR UPDATE TO authenticated
USING (
  sender_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "chat_msg_delete_own_or_admin"
ON public.chat_messages FOR DELETE TO authenticated
USING (
  sender_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Attachments
CREATE POLICY "chat_att_select_msg_visible"
ON public.chat_message_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = message_id
      AND (
        public.chat_conversation_type(m.conversation_id) = 'general'
        OR public.chat_is_participant(m.conversation_id, auth.uid())
      )
  )
);

CREATE POLICY "chat_att_insert_own_msg"
ON public.chat_message_attachments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = message_id AND m.sender_id = auth.uid()
  )
);

CREATE POLICY "chat_att_delete_own_or_admin"
ON public.chat_message_attachments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = message_id
      AND (m.sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

-- Reads
CREATE POLICY "chat_reads_select_self"
ON public.chat_message_reads FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.chat_messages m
  WHERE m.id = message_id AND m.sender_id = auth.uid()
));

CREATE POLICY "chat_reads_insert_self"
ON public.chat_message_reads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Presence
CREATE POLICY "chat_presence_select_all"
ON public.chat_presence FOR SELECT TO authenticated USING (true);

CREATE POLICY "chat_presence_upsert_self"
ON public.chat_presence FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_presence_update_self"
ON public.chat_presence FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Mentions
CREATE POLICY "chat_mentions_select_self_or_msg"
ON public.chat_mentions FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = message_id
      AND (
        public.chat_conversation_type(m.conversation_id) = 'general'
        OR public.chat_is_participant(m.conversation_id, auth.uid())
      )
  )
);

CREATE POLICY "chat_mentions_insert_own_msg"
ON public.chat_mentions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = message_id AND m.sender_id = auth.uid()
  )
);

-- Seed general conversation
INSERT INTO public.chat_conversations (type)
SELECT 'general' WHERE NOT EXISTS (SELECT 1 FROM public.chat_conversations WHERE type = 'general');

-- Realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_participants REPLICA IDENTITY FULL;
ALTER TABLE public.chat_message_reads REPLICA IDENTITY FULL;
ALTER TABLE public.chat_presence REPLICA IDENTITY FULL;
ALTER TABLE public.chat_message_attachments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_attachments;
