-- Item 3 of the security audit (read side, following item 2's write-RPC
-- fix): 3 SECURITY DEFINER functions had EXECUTE reachable by anon (via
-- the default PUBLIC grant) with no caller check, leaking performance and
-- XP data for arbitrary users via the public REST API.
--
-- get_user_xp_summary(_user_id) is called from the frontend (RewardsTimeline,
-- XPSummaryHeader) only with the caller's own auth.uid() — never someone
-- else's — so it's gated to self-or-admin.
--
-- get_performance_month_totals / get_performance_year_summary have no
-- frontend caller at all (grep across src/ confirms), and each returns
-- every user's performance data for a year in one call, so they're
-- admin-gated the same way the other Performance/XP report RPCs already
-- are, rather than left open for whenever a report UI picks them up.

CREATE OR REPLACE FUNCTION public.get_user_xp_summary(_user_id uuid)
 RETURNS TABLE(total_earned integer, total_spent integer, available integer, current_level integer, current_level_name text, next_level integer, next_level_name text, next_level_xp integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_earned int := 0;
  v_spent int := 0;
  v_avail int := 0;
  v_lvl_num int := 0;
  v_lvl_name text;
  v_next_num int;
  v_next_name text;
  v_next_xp int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(GREATEST(amount,0)),0) INTO v_earned FROM public.user_xp_events WHERE user_id = _user_id;
  SELECT v_earned + COALESCE(SUM(LEAST(amount,0)),0) INTO v_earned FROM public.user_xp_events WHERE user_id = _user_id;
  -- Simpler: total earned = sum of all events (allow negative adjustments by admin)
  SELECT COALESCE(SUM(amount),0) INTO v_earned FROM public.user_xp_events WHERE user_id = _user_id;
  SELECT COALESCE(SUM(xp_spent),0) INTO v_spent FROM public.reward_redemptions
    WHERE user_id = _user_id AND status IN ('pendente','aprovado','entregue');
  v_avail := v_earned - v_spent;

  SELECT level_number, name INTO v_lvl_num, v_lvl_name
  FROM public.reward_levels WHERE xp_required <= v_earned
  ORDER BY xp_required DESC LIMIT 1;

  SELECT level_number, name, xp_required INTO v_next_num, v_next_name, v_next_xp
  FROM public.reward_levels WHERE xp_required > v_earned
  ORDER BY xp_required ASC LIMIT 1;

  total_earned := v_earned;
  total_spent := v_spent;
  available := v_avail;
  current_level := COALESCE(v_lvl_num, 0);
  current_level_name := v_lvl_name;
  next_level := v_next_num;
  next_level_name := v_next_name;
  next_level_xp := v_next_xp;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_performance_month_totals(_year integer)
 RETURNS TABLE(user_id uuid, month integer, total numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    ps.user_id,
    ps.month,
    (ps.aprendizado_continuo + ps.padrao_qualidade_uau + ps.metas_prazos + ps.ambiente_organizado + ps.comprometimento) AS total
  FROM public.performance_scores ps
  WHERE ps.year = _year
  ORDER BY ps.month ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_performance_year_summary(_year integer)
 RETURNS TABLE(user_id uuid, total_year numeric, avg_month numeric, high_months integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
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
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_xp_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_xp_summary(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_performance_month_totals(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_month_totals(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_performance_year_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_year_summary(integer) TO authenticated;
