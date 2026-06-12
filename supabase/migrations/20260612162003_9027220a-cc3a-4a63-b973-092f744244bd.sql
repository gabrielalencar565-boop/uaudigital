
CREATE TABLE IF NOT EXISTS public.whatsapp_ranking_state (
  year int NOT NULL,
  month int NOT NULL,
  first_user_id uuid,
  top3_user_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, month)
);

GRANT SELECT ON public.whatsapp_ranking_state TO authenticated;
GRANT ALL ON public.whatsapp_ranking_state TO service_role;

ALTER TABLE public.whatsapp_ranking_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_state_admin_select" ON public.whatsapp_ranking_state;
CREATE POLICY "ranking_state_admin_select"
ON public.whatsapp_ranking_state FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.whatsapp_check_ranking_changes(_year int, _month int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top3 record;
  v_state record;
  v_new_first uuid;
  v_new_top3 uuid[];
  v_totals jsonb := '{}'::jsonb;
  v_full text;
  v_first text;
  v_vars jsonb;
  v_user uuid;
  v_total numeric;
BEGIN
  WITH ranked AS (
    SELECT user_id,
           (COALESCE(aprendizado_continuo,0)+COALESCE(padrao_qualidade_uau,0)+
            COALESCE(metas_prazos,0)+COALESCE(ambiente_organizado,0)+
            COALESCE(comprometimento,0))::numeric AS total
    FROM public.performance_scores
    WHERE year = _year AND month = _month
  ),
  ordered AS (
    SELECT user_id, total, row_number() OVER (ORDER BY total DESC, user_id) AS rn
    FROM ranked WHERE total > 0
  )
  SELECT
    (SELECT user_id FROM ordered WHERE rn = 1) AS first_user,
    COALESCE((SELECT array_agg(user_id ORDER BY rn) FROM ordered WHERE rn <= 3), '{}'::uuid[]) AS top3,
    COALESCE((SELECT jsonb_object_agg(user_id::text, total) FROM ordered WHERE rn <= 3), '{}'::jsonb) AS totals
  INTO v_top3;

  v_new_first := v_top3.first_user;
  v_new_top3 := v_top3.top3;
  v_totals := v_top3.totals;

  SELECT * INTO v_state FROM public.whatsapp_ranking_state WHERE year = _year AND month = _month;

  IF v_state IS NULL THEN
    INSERT INTO public.whatsapp_ranking_state (year, month, first_user_id, top3_user_ids)
    VALUES (_year, _month, v_new_first, v_new_top3);
    RETURN;
  END IF;

  IF v_new_first IS NOT NULL AND v_new_first IS DISTINCT FROM v_state.first_user_id THEN
    SELECT full_name INTO v_full FROM public.profiles WHERE user_id = v_new_first;
    v_first := split_part(COALESCE(v_full, ''), ' ', 1);
    v_total := COALESCE((v_totals ->> v_new_first::text)::numeric, 0);
    v_vars := jsonb_build_object(
      'nome', COALESCE(v_full, ''),
      'primeiro_nome', v_first,
      'xp', v_total::text,
      'ranking', '1º Lugar'
    );
    PERFORM public.whatsapp_dispatch_event(
      'xp_first', v_vars, v_new_first,
      format('rt_first:%s-%s:%s', _year, _month, v_new_first)
    );
  END IF;

  FOREACH v_user IN ARRAY v_new_top3 LOOP
    IF NOT (v_user = ANY (COALESCE(v_state.top3_user_ids, '{}'::uuid[]))) THEN
      SELECT full_name INTO v_full FROM public.profiles WHERE user_id = v_user;
      v_first := split_part(COALESCE(v_full, ''), ' ', 1);
      v_total := COALESCE((v_totals ->> v_user::text)::numeric, 0);
      v_vars := jsonb_build_object(
        'nome', COALESCE(v_full, ''),
        'primeiro_nome', v_first,
        'xp', v_total::text,
        'ranking', 'Top 3'
      );
      PERFORM public.whatsapp_dispatch_event(
        'xp_top3', v_vars, v_user,
        format('rt_top3:%s-%s:%s', _year, _month, v_user)
      );
    END IF;
  END LOOP;

  UPDATE public.whatsapp_ranking_state
  SET first_user_id = v_new_first,
      top3_user_ids = v_new_top3,
      updated_at = now()
  WHERE year = _year AND month = _month;
END;
$$;

GRANT EXECUTE ON FUNCTION public.whatsapp_check_ranking_changes(int, int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.performance_scores_check_ranking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_y int; v_m int;
BEGIN
  v_y := COALESCE(NEW.year, OLD.year);
  v_m := COALESCE(NEW.month, OLD.month);
  IF v_y IS NOT NULL AND v_m IS NOT NULL THEN
    PERFORM public.whatsapp_check_ranking_changes(v_y, v_m);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_performance_scores_check_ranking ON public.performance_scores;
CREATE TRIGGER trg_performance_scores_check_ranking
AFTER INSERT OR UPDATE OR DELETE ON public.performance_scores
FOR EACH ROW EXECUTE FUNCTION public.performance_scores_check_ranking();

SELECT public.whatsapp_check_ranking_changes(
  EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int,
  EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int
);
