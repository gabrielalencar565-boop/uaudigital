-- Fix advisor findings from the calendario_publicacao migration:
-- 1) calendar_cycle_bounds had a mutable search_path.
-- 2) pm_task_pdf_stage_to_calendar is a trigger-only function but PostgREST's
--    default grants left it callable directly via /rest/v1/rpc/ by anon and
--    authenticated (same class of issue already fixed elsewhere in this repo
--    for list_users_admin/XP RPCs) — it's SECURITY DEFINER and does no caller
--    check since it's only meant to run as a trigger, so revoke direct RPC
--    execute entirely; trigger firing is unaffected by this revoke.

CREATE OR REPLACE FUNCTION public.calendar_cycle_bounds(_ref date)
RETURNS TABLE (cycle_start date, cycle_end date)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT
    CASE WHEN EXTRACT(DAY FROM _ref) >= 28
      THEN date_trunc('month', _ref)::date + INTERVAL '27 days'
      ELSE (date_trunc('month', _ref) - INTERVAL '1 month')::date + INTERVAL '27 days'
    END AS cycle_start,
    CASE WHEN EXTRACT(DAY FROM _ref) >= 28
      THEN (date_trunc('month', _ref) + INTERVAL '1 month')::date + INTERVAL '26 days'
      ELSE date_trunc('month', _ref)::date + INTERVAL '26 days'
    END AS cycle_end;
$function$;

REVOKE EXECUTE ON FUNCTION public.pm_task_pdf_stage_to_calendar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pm_task_pdf_stage_to_calendar() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pm_task_pdf_stage_to_calendar() FROM authenticated;
