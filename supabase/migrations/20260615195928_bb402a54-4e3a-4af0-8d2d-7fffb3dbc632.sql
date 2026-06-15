
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

  -- Only send if an enabled automation exists for task_assigned.
  -- Legacy fallback removed so disabling the automation truly stops messages.
  PERFORM public.whatsapp_dispatch_event('task_assigned', v_vars, v_target, NEW.id::text);

  RETURN NEW;
END;
$function$;
