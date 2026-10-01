-- pm_tasks.posting_time is text (e.g. "14:30" or ''); calendar_publications.publish_time is
-- a real time column. A prior migration (20260804212027_calendario_publish_time_cast_security_fix)
-- already fixed this exact cast once, but got silently reverted along with the other two bugs
-- fixed in this function today, since all three stemmed from reconstructing the function from
-- the original creation migration instead of the live definition. NULLIF guards the empty-string
-- case (an empty string isn't a valid `time` literal and would otherwise error the same way).
CREATE OR REPLACE FUNCTION public.pm_task_pdf_stage_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bounds record;
  v_calendar_id uuid;
BEGIN
  IF NEW.stage_current IS DISTINCT FROM 'pdf' THEN
    RETURN NEW;
  END IF;
  IF NEW.posting_date IS NULL THEN
    RETURN NEW; -- no explicit month chosen yet — stays unscheduled
  END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_bounds FROM public.calendar_cycle_bounds(NEW.posting_date);

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
