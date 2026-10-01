-- The previous version of this function (pm_task_pdf_stage_to_calendar_no_guessing) kept an
-- old guard — "skip if OLD.stage_current was already 'pdf'" — that made sense under the old
-- auto-guessing behavior (a row was always created the instant a task first hit 'pdf', so a
-- later update could never be the "first" one) but is wrong now: a task can sit in 'pdf' with
-- no calendar row for a long time, and posting_date is typically set in a LATER update (via
-- SendToCronogramaButton / the Cronograma panel's "Sem mês definido" section), where
-- OLD.stage_current is already 'pdf'. That guard was silently skipping exactly that case —
-- confirmed live: Elis e Valdemir (336bff14-ec6c-462f-bbf2-7a398351aad6) got posting_date set
-- but no calendar_publications row. The EXISTS check below already prevents duplicate rows on
-- its own, making the OLD.stage_current guard both redundant and harmful — removed.
CREATE OR REPLACE FUNCTION public.pm_task_pdf_stage_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bounds record;
  v_calendar_id uuid;
  v_content_type public.publication_content_type;
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

  v_content_type := CASE NEW.post_type
    WHEN 'reels' THEN 'reel'::public.publication_content_type
    WHEN 'carrossel' THEN 'carrossel'::public.publication_content_type
    WHEN 'post' THEN 'imagem'::public.publication_content_type
    WHEN 'foto' THEN 'imagem'::public.publication_content_type
    ELSE 'outro'::public.publication_content_type
  END;

  INSERT INTO public.calendar_publications (
    calendar_id, task_id, title, content_type, caption, publish_date, publish_time
  ) VALUES (
    v_calendar_id, NEW.id, NEW.title, v_content_type, NEW.caption, NEW.posting_date, NEW.posting_time
  )
  ON CONFLICT (task_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
