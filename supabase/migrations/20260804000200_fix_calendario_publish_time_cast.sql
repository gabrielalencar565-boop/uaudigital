-- pm_tasks.posting_time is `text` (e.g. "09:30"), not `time`, so the plain
-- INSERT in pm_task_pdf_stage_to_calendar() failed with:
--   column "publish_time" is of type time without time zone but expression is of type text
-- Cast explicitly, and fall back to NULL instead of raising if a row ever has
-- a malformed value, so one bad posting_time never blocks the task update.

CREATE OR REPLACE FUNCTION public.pm_task_pdf_stage_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ref date;
  v_bounds record;
  v_calendar_id uuid;
  v_content_type public.publication_content_type;
  v_publish_time time;
BEGIN
  IF NEW.stage_current IS DISTINCT FROM 'pdf' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage_current = 'pdf' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_ref := COALESCE(NEW.posting_date, NEW.due_date, CURRENT_DATE);
  SELECT * INTO v_bounds FROM public.calendar_cycle_bounds(v_ref);

  INSERT INTO public.publication_calendars (client_id, cycle_start, cycle_end)
  VALUES (NEW.client_id, v_bounds.cycle_start, v_bounds.cycle_end)
  ON CONFLICT (client_id, cycle_start) DO UPDATE SET client_id = EXCLUDED.client_id
  RETURNING id INTO v_calendar_id;

  v_content_type := CASE NEW.post_type
    WHEN 'reels' THEN 'reel'::public.publication_content_type
    WHEN 'carrossel' THEN 'carrossel'::public.publication_content_type
    WHEN 'post' THEN 'imagem'::public.publication_content_type
    WHEN 'foto' THEN 'imagem'::public.publication_content_type
    ELSE 'outro'::public.publication_content_type
  END;

  BEGIN
    v_publish_time := NEW.posting_time::time;
  EXCEPTION WHEN OTHERS THEN
    v_publish_time := NULL;
  END;

  INSERT INTO public.calendar_publications (
    calendar_id, task_id, title, content_type, caption, publish_date, publish_time
  ) VALUES (
    v_calendar_id, NEW.id, NEW.title, v_content_type, NEW.caption, NEW.posting_date, v_publish_time
  )
  ON CONFLICT (task_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- CREATE OR REPLACE FUNCTION resets grants to default, re-exposing this
-- trigger-only SECURITY DEFINER function to anon/authenticated via
-- PostgREST RPC. Re-revoke after the cast fix above.
REVOKE EXECUTE ON FUNCTION public.pm_task_pdf_stage_to_calendar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pm_task_pdf_stage_to_calendar() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pm_task_pdf_stage_to_calendar() FROM authenticated;
