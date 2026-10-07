-- A stage-advance clone ("Agendamento - Setembro" cloned from "Cronograma - Setembro") re-enters the PDF stage and used to
-- get its own blank publication per post, so the Cronograma showed every post twice (once dated, once under
-- "Publicações sem data"), and the container itself showed up as an "Outro" publication.
--
-- 1) pm_task_pdf_stage_to_calendar: no publication for a container that already has subtasks, and none for a task whose
--    lineage (same client, same title, same origin) already has a live publication.
-- 2) pm_task_soft_delete_cleanup_calendar: when a task with a publication is deleted and a live twin of it has none, the
--    publication (date, caption, Instagram state) moves to the twin instead of disappearing from the Cronograma.

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
BEGIN
  IF NEW.stage_current IS DISTINCT FROM 'pdf' THEN
    RETURN NEW;
  END IF;
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
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_bounds FROM public.calendar_cycle_bounds(COALESCE(NEW.posting_date, CURRENT_DATE));

  INSERT INTO public.publication_calendars (client_id, cycle_start, cycle_end)
  VALUES (NEW.client_id, v_bounds.cycle_start, v_bounds.cycle_end)
  ON CONFLICT (client_id, cycle_start) DO UPDATE SET client_id = EXCLUDED.client_id
  RETURNING id INTO v_calendar_id;

  INSERT INTO public.calendar_publications (
    calendar_id, task_id, title, content_type, caption, publish_date, publish_time
  ) VALUES (
    v_calendar_id, NEW.id, NEW.title, public.pm_resolve_content_type(NEW.tags, NEW.post_type), NEW.caption, NEW.posting_date, NULLIF(NEW.posting_time, '')::time
  )
  ON CONFLICT (task_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pm_task_soft_delete_cleanup_calendar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_root uuid;
  v_twin uuid;
BEGIN
  IF new.deleted_at IS NOT NULL AND old.deleted_at IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = new.id AND deleted_at IS NULL) THEN
      SELECT COALESCE(c.origin_task_id, c.id) INTO v_root
      FROM public.pm_tasks c WHERE c.id = COALESCE(new.parent_task_id, new.id);

      SELECT t.id INTO v_twin
      FROM public.pm_tasks t
      JOIN public.pm_tasks tc ON tc.id = COALESCE(t.parent_task_id, t.id)
      WHERE t.id <> new.id
        AND t.deleted_at IS NULL
        AND tc.deleted_at IS NULL
        AND t.client_id IS NOT DISTINCT FROM new.client_id
        AND t.title = new.title
        AND COALESCE(tc.origin_task_id, tc.id) = v_root
        AND NOT EXISTS (SELECT 1 FROM public.calendar_publications x WHERE x.task_id = t.id)
      LIMIT 1;

      IF v_twin IS NOT NULL THEN
        UPDATE public.calendar_publications SET task_id = v_twin WHERE task_id = new.id AND deleted_at IS NULL;
        RETURN new;
      END IF;
    END IF;
    UPDATE public.calendar_publications SET deleted_at = now() WHERE task_id = new.id AND deleted_at IS NULL;
  ELSIF new.deleted_at IS NULL AND old.deleted_at IS NOT NULL THEN
    UPDATE public.calendar_publications SET deleted_at = NULL WHERE task_id = new.id AND deleted_at IS NOT NULL;
  END IF;
  RETURN new;
END;
$function$;
