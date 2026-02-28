
-- Drop functions with changed return types
DROP FUNCTION IF EXISTS public.get_performance_month_totals(integer);
DROP FUNCTION IF EXISTS public.get_performance_year_summary(integer);

-- Recreate with numeric return types
CREATE OR REPLACE FUNCTION public.get_performance_month_totals(_year integer)
 RETURNS TABLE(user_id uuid, month integer, total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    ps.user_id,
    ps.month,
    (ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento) AS total
  FROM public.performance_scores ps
  WHERE ps.year = _year
  ORDER BY ps.month ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_performance_year_summary(_year integer)
 RETURNS TABLE(user_id uuid, total_year numeric, avg_month numeric, high_months integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH month_totals AS (
    SELECT
      ps.user_id,
      ps.month,
      (ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento) AS total
    FROM public.performance_scores ps
    WHERE ps.year = _year
  )
  SELECT
    mt.user_id,
    COALESCE(SUM(mt.total), 0) AS total_year,
    COALESCE(AVG(mt.total), 0) AS avg_month,
    COALESCE(SUM(CASE WHEN mt.total >= 7 THEN 1 ELSE 0 END), 0)::int AS high_months
  FROM month_totals mt
  GROUP BY mt.user_id
  ORDER BY total_year DESC;
$function$;
