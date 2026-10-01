-- This function's content_type mapping was stale — it still had 'post'/'foto' mapped to the
-- enum value 'imagem', which migration 20260809183353_remove_imagem_content_type later
-- dropped from publication_content_type entirely (replaced by the current, tag-aware
-- pm_resolve_content_type()). That stale mapping was carried forward unnoticed through
-- pm_task_pdf_stage_to_calendar_no_guessing's CREATE OR REPLACE earlier today, and broke the
-- very first real insert it tried to do (confirmed live: ERROR 22P02 "invalid input value for
-- enum publication_content_type: imagem" assigning a month to Elis e Valdemir). Switching to
-- the shared resolver fixes this and keeps this function in sync with however that mapping
-- evolves elsewhere, instead of carrying its own copy.
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
    v_calendar_id, NEW.id, NEW.title, public.pm_resolve_content_type(NEW.tags, NEW.post_type), NEW.caption, NEW.posting_date, NEW.posting_time
  )
  ON CONFLICT (task_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
