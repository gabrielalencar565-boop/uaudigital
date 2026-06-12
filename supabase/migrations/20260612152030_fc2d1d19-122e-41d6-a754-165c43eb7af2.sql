ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS msg_new_task_intro          text NOT NULL DEFAULT '🆕 Nova tarefa atribuída:',
  ADD COLUMN IF NOT EXISTS msg_deadline_today_intro    text NOT NULL DEFAULT '⏰ Prazo hoje:',
  ADD COLUMN IF NOT EXISTS msg_deadline_tomorrow_intro text NOT NULL DEFAULT '⏰ Prazo amanhã:',
  ADD COLUMN IF NOT EXISTS msg_deadline_overdue_intro  text NOT NULL DEFAULT '⚠️ Prazo atrasado:',
  ADD COLUMN IF NOT EXISTS msg_xp_rank_intro           text NOT NULL DEFAULT '🏆 Ranking do mês:',
  ADD COLUMN IF NOT EXISTS msg_broadcast_intro         text NOT NULL DEFAULT '📣 Aviso da equipe:';

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

  SELECT COALESCE(NULLIF(msg_new_task_intro, ''), '🆕 Nova tarefa atribuída:')
    INTO v_intro FROM public.whatsapp_settings WHERE id = 1;

  v_msg := COALESCE(v_intro, '🆕 Nova tarefa atribuída:') || ' ' || COALESCE(NEW.title, 'sem título')
        || E'\nCliente: ' || COALESCE(v_client_name, '—')
        || E'\nPrazo: ' || v_due;

  PERFORM public.whatsapp_enqueue(v_target, 'new_task', v_msg, NEW.id::text);

  RETURN NEW;
END;
$$;