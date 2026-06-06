-- =========================================================
-- Sistema de Recompensas (XP, Níveis, Catálogo, Resgates)
-- =========================================================

-- Enum de status do resgate
DO $$ BEGIN
  CREATE TYPE public.reward_redemption_status AS ENUM ('pendente','aprovado','recusado','entregue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- reward_levels ----------
CREATE TABLE public.reward_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number int NOT NULL UNIQUE,
  name text NOT NULL,
  xp_required int NOT NULL,
  exclusive_reward text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_levels TO authenticated;
GRANT ALL ON public.reward_levels TO service_role;
ALTER TABLE public.reward_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY reward_levels_select_auth ON public.reward_levels FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY reward_levels_admin_all ON public.reward_levels FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- ---------- rewards ----------
CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text DEFAULT 'gift',
  xp_cost int NOT NULL CHECK (xp_cost >= 0),
  min_level int NOT NULL DEFAULT 1,
  is_exclusive boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY rewards_select_auth ON public.rewards FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY rewards_admin_all ON public.rewards FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- ---------- user_xp_events ----------
CREATE TABLE public.user_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount int NOT NULL,
  reason text NOT NULL,
  source_type text,
  source_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_xp_events_user_idx ON public.user_xp_events(user_id);
GRANT SELECT ON public.user_xp_events TO authenticated;
GRANT ALL ON public.user_xp_events TO service_role;
ALTER TABLE public.user_xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_xp_events_select_own ON public.user_xp_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY user_xp_events_admin_all ON public.user_xp_events FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- ---------- reward_redemptions ----------
CREATE TABLE public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_id uuid NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  xp_spent int NOT NULL,
  status public.reward_redemption_status NOT NULL DEFAULT 'pendente',
  notes text,
  decided_by uuid,
  decided_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reward_redemptions_user_idx ON public.reward_redemptions(user_id);
CREATE INDEX reward_redemptions_status_idx ON public.reward_redemptions(status);
GRANT SELECT, INSERT ON public.reward_redemptions TO authenticated;
GRANT ALL ON public.reward_redemptions TO service_role;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY reward_redemptions_select_own ON public.reward_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY reward_redemptions_insert_own ON public.reward_redemptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY reward_redemptions_admin_all ON public.reward_redemptions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- updated_at triggers
CREATE TRIGGER trg_reward_levels_uat BEFORE UPDATE ON public.reward_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rewards_uat BEFORE UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_reward_redemptions_uat BEFORE UPDATE ON public.reward_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Helper functions ----------
CREATE OR REPLACE FUNCTION public.get_user_xp_summary(_user_id uuid)
RETURNS TABLE(total_earned int, total_spent int, available int, current_level int, current_level_name text, next_level int, next_level_name text, next_level_xp int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.get_user_xp_summary(uuid) TO authenticated;

-- ---------- Seeds ----------
INSERT INTO public.reward_levels (level_number, name, xp_required, exclusive_reward) VALUES
  (1,  'Iniciante',     0,    NULL),
  (5,  'Engajado',      500,  'Vale-presente'),
  (10, 'Destaque',      1500, 'Dia de folga'),
  (15, 'Veterano',      3000, 'Curso pago pela UAU'),
  (20, 'Lenda UAU',     6000, 'Prêmio Lenda UAU');

INSERT INTO public.rewards (name, description, icon, xp_cost, min_level, is_exclusive, order_index) VALUES
  ('Vale Lanche',          'Um lanche por nossa conta 🍔', 'gift',     150,  1, false, 1),
  ('Vale Pizza',           'Uma pizza inteira para você 🍕', 'pizza',  400,  1, false, 2),
  ('Meio Período de Folga','Saia mais cedo num dia da semana 🌅', 'sun', 1200, 5, false, 3),
  ('Dia de Folga',         'Um dia inteiro de folga 🏖️', 'palmtree', 2000, 10, true, 4);
