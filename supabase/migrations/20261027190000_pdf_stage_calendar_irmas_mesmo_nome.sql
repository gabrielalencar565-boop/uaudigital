-- Duas tarefas irmãs (mesma tarefa-mãe do Cronograma) com o mesmo título, ex.: dois "FOTO", são posts diferentes.
-- A regra anti-duplicata de pm_task_pdf_stage_to_calendar() as tratava como o mesmo post e a segunda
-- nunca chegava ao Cronograma ("Enviar para o Cronograma" dizia que enviou, mas não criava nada).
-- A regra continua valendo para cópias do mesmo post em outro container (ex.: snapshot de Alteração).
CREATE OR REPLACE FUNCTION public.pm_task_pdf_stage_to_calendar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bounds record;
  v_calendar_id uuid;
  v_root uuid;
  v_old uuid;
BEGIN
  IF NEW.stage_current IS DISTINCT FROM 'pdf' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id AND deleted_at IS NULL) THEN
    RETURN NEW;
  END IF;

  -- removida por uma pessoa do Cronograma (lixeira): volta como estava
  UPDATE public.calendar_publications SET deleted_at = NULL, deleted_by = NULL
  WHERE task_id = NEW.id AND deleted_at IS NOT NULL AND deleted_by IS NOT NULL;
  IF FOUND THEN
    RETURN NEW;
  END IF;

  -- o resto (publicação que saiu junto com a tarefa apagada) segue como antes
  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- a container is represented by its subtasks, never by a publication of its own
  IF EXISTS (SELECT 1 FROM public.pm_tasks c WHERE c.parent_task_id = NEW.id AND c.deleted_at IS NULL) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(c.origin_task_id, c.id) INTO v_root
  FROM public.pm_tasks c WHERE c.id = COALESCE(NEW.parent_task_id, NEW.id);

  IF EXISTS (
    SELECT 1
    FROM public.calendar_publications cp
    JOIN public.pm_tasks ot ON ot.id = cp.task_id
    JOIN public.pm_tasks oc ON oc.id = COALESCE(ot.parent_task_id, ot.id)
    WHERE cp.deleted_at IS NULL
      AND ot.id <> NEW.id
      AND ot.deleted_at IS NULL
      AND ot.client_id IS NOT DISTINCT FROM NEW.client_id
      AND ot.title = NEW.title
      AND COALESCE(oc.origin_task_id, oc.id) = v_root
      -- irmã na mesma tarefa-mãe com o mesmo nome é outro post, não uma cópia
      AND (NEW.parent_task_id IS NULL OR ot.parent_task_id IS DISTINCT FROM NEW.parent_task_id)
  ) THEN
    RETURN NEW;
  END IF;

  -- the same post was deleted along with its task and is coming back through the pipeline: take its publication back
  SELECT cp.id INTO v_old
  FROM public.calendar_publications cp
  JOIN public.pm_tasks ot ON ot.id = cp.task_id
  JOIN public.pm_tasks oc ON oc.id = COALESCE(ot.parent_task_id, ot.id)
  WHERE cp.deleted_at IS NOT NULL
    AND ot.id <> NEW.id
    AND ot.deleted_at IS NOT NULL
    AND ot.client_id IS NOT DISTINCT FROM NEW.client_id
    AND ot.title = NEW.title
    AND COALESCE(oc.origin_task_id, oc.id) = v_root
    AND (cp.publish_date IS NOT NULL OR cp.publish_time IS NOT NULL OR COALESCE(cp.caption, '') <> ''
         OR cp.cover_attachment_id IS NOT NULL OR cp.instagram_scheduled IS TRUE)
  ORDER BY cp.deleted_at DESC, cp.updated_at DESC
  LIMIT 1;

  IF v_old IS NOT NULL THEN
    UPDATE public.calendar_publications SET task_id = NEW.id, deleted_at = NULL WHERE id = v_old;
    RETURN NEW;
  END IF;

  v_calendar_id := public.calendar_for_date(NEW.client_id, NEW.agency_id, COALESCE(NEW.posting_date, CURRENT_DATE));

  INSERT INTO public.calendar_publications (
    calendar_id, task_id, title, content_type, caption, publish_date, publish_time
  ) VALUES (
    v_calendar_id, NEW.id, NEW.title, public.pm_resolve_content_type(NEW.tags, NEW.post_type), NEW.caption, NEW.posting_date, NULLIF(NEW.posting_time, '')::time
  )
  ON CONFLICT (task_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
