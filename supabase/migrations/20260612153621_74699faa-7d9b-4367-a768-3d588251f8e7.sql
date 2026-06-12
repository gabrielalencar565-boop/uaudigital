
-- =========================================================
-- 1. Table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL CHECK (trigger_type IN ('event','schedule')),
  trigger_key text NOT NULL,
  schedule_time text,                          -- 'HH:MM' (24h) for schedule type
  schedule_days smallint[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sun..6=Sat
  message_template text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  audience text NOT NULL DEFAULT 'assignee',   -- assignee | all_team | top_3 | admins | role:<r>
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_slot text,                          -- 'YYYY-MM-DD HH:MM' to dedupe schedule ticks
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_automations TO authenticated;
GRANT ALL ON public.whatsapp_automations TO service_role;

ALTER TABLE public.whatsapp_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_automations_admin_all"
ON public.whatsapp_automations FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_whatsapp_automations_key
  ON public.whatsapp_automations (trigger_type, trigger_key, enabled);

CREATE OR REPLACE FUNCTION public.whatsapp_automations_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_automations_touch ON public.whatsapp_automations;
CREATE TRIGGER trg_whatsapp_automations_touch
BEFORE UPDATE ON public.whatsapp_automations
FOR EACH ROW EXECUTE FUNCTION public.whatsapp_automations_touch();

-- =========================================================
-- 2. Dispatch function (used by event triggers)
-- =========================================================
CREATE OR REPLACE FUNCTION public.whatsapp_dispatch_event(
  _key text,
  _vars jsonb,
  _user_id uuid,
  _source_ref text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auto record;
  v_msg text;
  v_count int := 0;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  FOR v_auto IN
    SELECT id, message_template, audience
    FROM public.whatsapp_automations
    WHERE enabled = true
      AND trigger_type = 'event'
      AND trigger_key = _key
  LOOP
    v_msg := public.apply_msg_template(v_auto.message_template, _vars);
    IF v_msg IS NULL OR length(trim(v_msg)) = 0 THEN CONTINUE; END IF;

    -- Only "assignee" audience is meaningful for DB-side events; other audiences
    -- (all_team, top_3, etc.) are handled by the edge runtime for richer payloads.
    PERFORM public.whatsapp_enqueue(_user_id, _key, v_msg, _source_ref);
    UPDATE public.whatsapp_automations SET last_run_at = now() WHERE id = v_auto.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- =========================================================
-- 3. Rewrite new-task trigger to use automation engine
-- =========================================================
CREATE OR REPLACE FUNCTION public.pm_tasks_whatsapp_notify_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_should boolean := false;
  v_target uuid;
  v_client_name text;
  v_due text;
  v_full_name text;
  v_first_name text;
  v_vars jsonb;
  v_dispatched int;
  v_intro text;
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
  SELECT full_name INTO v_full_name FROM public.profiles WHERE user_id = v_target;
  v_first_name := split_part(COALESCE(v_full_name, ''), ' ', 1);

  v_vars := jsonb_build_object(
    'nome', COALESCE(v_full_name, ''),
    'primeiro_nome', v_first_name,
    'tarefa', COALESCE(NEW.title, 'sem título'),
    'cliente', COALESCE(v_client_name, '—'),
    'prazo', v_due
  );

  v_dispatched := public.whatsapp_dispatch_event('task_assigned', v_vars, v_target, NEW.id::text);

  -- Legacy fallback: if no automation handled it, use the static intro from whatsapp_settings.
  IF v_dispatched = 0 THEN
    SELECT COALESCE(NULLIF(msg_new_task_intro, ''), '🆕 Nova tarefa atribuída:')
      INTO v_intro FROM public.whatsapp_settings WHERE id = 1;
    IF v_intro LIKE '%{%}%' THEN
      v_msg := public.apply_msg_template(v_intro, v_vars);
    ELSE
      v_msg := v_intro || ' ' || COALESCE(NEW.title, 'sem título')
            || E'\nCliente: ' || COALESCE(v_client_name, '—')
            || E'\nPrazo: ' || v_due;
    END IF;
    PERFORM public.whatsapp_enqueue(v_target, 'new_task', v_msg, NEW.id::text);
  END IF;

  RETURN NEW;
END;
$function$;

-- =========================================================
-- 4. Task completed trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.pm_tasks_whatsapp_notify_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target uuid;
  v_client_name text;
  v_due text;
  v_full_name text;
  v_first_name text;
  v_vars jsonb;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.status_global IS DISTINCT FROM 'concluido' THEN RETURN NEW; END IF;
  IF OLD.status_global = 'concluido' THEN RETURN NEW; END IF;

  v_target := COALESCE(NEW.assignee_id, NEW.created_by);
  IF v_target IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  v_due := COALESCE(to_char(NEW.due_date, 'DD/MM/YYYY'), 'sem prazo');
  SELECT full_name INTO v_full_name FROM public.profiles WHERE user_id = v_target;
  v_first_name := split_part(COALESCE(v_full_name, ''), ' ', 1);

  v_vars := jsonb_build_object(
    'nome', COALESCE(v_full_name, ''),
    'primeiro_nome', v_first_name,
    'tarefa', COALESCE(NEW.title, 'sem título'),
    'cliente', COALESCE(v_client_name, '—'),
    'prazo', v_due
  );

  PERFORM public.whatsapp_dispatch_event('task_completed', v_vars, v_target, NEW.id::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pm_tasks_whatsapp_completed ON public.pm_tasks;
CREATE TRIGGER trg_pm_tasks_whatsapp_completed
AFTER UPDATE ON public.pm_tasks
FOR EACH ROW EXECUTE FUNCTION public.pm_tasks_whatsapp_notify_completed();

-- =========================================================
-- 5. XP event trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.user_xp_events_whatsapp_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_full_name text;
  v_first_name text;
  v_vars jsonb;
  v_key text;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  SELECT full_name INTO v_full_name FROM public.profiles WHERE user_id = NEW.user_id;
  v_first_name := split_part(COALESCE(v_full_name, ''), ' ', 1);

  v_vars := jsonb_build_object(
    'nome', COALESCE(v_full_name, ''),
    'primeiro_nome', v_first_name,
    'xp', NEW.amount::text,
    'ranking', COALESCE(NEW.reason, '')
  );

  -- Always fire generic xp_gain
  PERFORM public.whatsapp_dispatch_event('xp_gain', v_vars, NEW.user_id, NEW.id::text);

  -- Specific keys based on source_type
  v_key := CASE NEW.source_type
    WHEN 'auto_rank_1' THEN 'xp_first'
    WHEN 'auto_rank_2' THEN 'xp_top3'
    WHEN 'level_up' THEN 'xp_level_up'
    ELSE NULL
  END;
  IF v_key IS NOT NULL THEN
    PERFORM public.whatsapp_dispatch_event(v_key, v_vars, NEW.user_id, NEW.id::text);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_xp_events_whatsapp ON public.user_xp_events;
CREATE TRIGGER trg_user_xp_events_whatsapp
AFTER INSERT ON public.user_xp_events
FOR EACH ROW EXECUTE FUNCTION public.user_xp_events_whatsapp_notify();

-- =========================================================
-- 6. Seed default automations (idempotent)
-- =========================================================
INSERT INTO public.whatsapp_automations (name, description, trigger_type, trigger_key, schedule_time, message_template, audience)
SELECT * FROM (VALUES
  ('Nova tarefa atribuída', 'Notifica o colaborador quando uma nova tarefa é atribuída a ele.', 'event', 'task_assigned', NULL,
   E'🆕 Olá, {primeiro_nome}!\nVocê recebeu uma nova tarefa: "{tarefa}"\nCliente: {cliente}\nPrazo: {prazo}', 'assignee'),
  ('Tarefa concluída', 'Confirma para o colaborador quando uma tarefa é marcada como concluída.', 'event', 'task_completed', NULL,
   E'✅ {primeiro_nome}, tarefa "{tarefa}" concluída! Bom trabalho.', 'assignee'),
  ('Prazo hoje', 'Lembrete diário das tarefas que vencem no dia.', 'schedule', 'deadline_today', '08:00',
   E'⏰ {primeiro_nome}, a tarefa "{tarefa}" vence hoje ({prazo}).', 'assignee'),
  ('Prazo amanhã', 'Lembrete diário das tarefas que vencem no dia seguinte.', 'schedule', 'deadline_tomorrow', '17:00',
   E'⏰ {primeiro_nome}, a tarefa "{tarefa}" vence amanhã ({prazo}).', 'assignee'),
  ('Prazo atrasado', 'Aviso diário para tarefas vencidas há 1 dia ou mais.', 'schedule', 'deadline_overdue', '09:00',
   E'⚠️ {primeiro_nome}, a tarefa "{tarefa}" está atrasada (venceu em {prazo}).', 'assignee'),
  ('Agenda diária', 'Resumo matinal com todas as tarefas do dia do colaborador.', 'schedule', 'daily_agenda', '08:30',
   E'🌞 Bom dia, {primeiro_nome}!\n\nSua agenda de hoje:\n\n{tarefas_do_dia}\n\nVamos fazer mais um dia produtivo! 🚀', 'all_team'),
  ('Resumo do dia', 'Resumo das tarefas concluídas ao fim do dia.', 'schedule', 'daily_summary', '19:00',
   E'🌙 {primeiro_nome}, resumo do dia:\n\nConcluídas: {tarefas_concluidas}\nAtrasadas: {tarefas_atrasadas}', 'all_team'),
  ('Resumo semanal', 'Resumo das tarefas concluídas na semana.', 'schedule', 'weekly_summary', '18:00',
   E'📊 {primeiro_nome}, seu resumo da semana:\n\nConcluídas: {tarefas_concluidas}', 'all_team'),
  ('Subiu de nível', 'Comemora quando o colaborador sobe de nível no XP.', 'event', 'xp_level_up', NULL,
   E'🎉 {primeiro_nome}, você subiu para o nível {nivel}! Continue assim.', 'assignee'),
  ('Entrou no Top 3', 'Avisa quando o colaborador entra no Top 3 mensal.', 'event', 'xp_top3', NULL,
   E'🥉 {primeiro_nome}, você entrou no Top 3 do mês! Parabéns!', 'assignee'),
  ('Assumiu 1º lugar', 'Avisa quando o colaborador chega ao 1º lugar do ranking mensal.', 'event', 'xp_first', NULL,
   E'🥇 {primeiro_nome}, você assumiu o 1º lugar do mês! Show!', 'assignee'),
  ('Ganho de XP', 'Notifica qualquer ganho de XP recebido.', 'event', 'xp_gain', NULL,
   E'⭐ {primeiro_nome}, você ganhou {xp} XP: {ranking}', 'assignee')
) AS v(name, description, trigger_type, trigger_key, schedule_time, message_template, audience)
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_automations a WHERE a.trigger_key = v.trigger_key
);
