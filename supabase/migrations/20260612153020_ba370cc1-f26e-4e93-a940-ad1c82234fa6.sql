
CREATE OR REPLACE FUNCTION public.apply_msg_template(_template text, _vars jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text := COALESCE(_template, '');
  k text;
  v text;
BEGIN
  IF _vars IS NULL THEN RETURN result; END IF;
  FOR k, v IN SELECT key, COALESCE(value #>> '{}', '') FROM jsonb_each(_vars) LOOP
    result := replace(result, '{' || k || '}', v);
  END LOOP;
  RETURN result;
END;
$$;

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
  v_intro text;
  v_msg text;
  v_full_name text;
  v_first_name text;
  v_vars jsonb;
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

  SELECT full_name INTO v_full_name FROM public.profiles WHERE user_id = v_target;
  v_first_name := split_part(COALESCE(v_full_name, ''), ' ', 1);

  v_vars := jsonb_build_object(
    'nome', COALESCE(v_full_name, ''),
    'primeiro_nome', v_first_name,
    'tarefa', COALESCE(NEW.title, 'sem título'),
    'cliente', COALESCE(v_client_name, '—'),
    'prazo', v_due
  );

  IF v_intro LIKE '%{%}%' THEN
    v_msg := public.apply_msg_template(v_intro, v_vars);
  ELSE
    v_msg := v_intro || ' ' || COALESCE(NEW.title, 'sem título')
          || E'\nCliente: ' || COALESCE(v_client_name, '—')
          || E'\nPrazo: ' || v_due;
  END IF;

  PERFORM public.whatsapp_enqueue(v_target, 'new_task', v_msg, NEW.id::text);

  RETURN NEW;
END;
$function$;
