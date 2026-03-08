
-- Squads table
CREATE TABLE public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7C5CFF',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "squads_select_auth" ON public.squads FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "squads_admin_all" ON public.squads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Squad members table
CREATE TABLE public.squad_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(squad_id, user_id)
);

ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "squad_members_select_auth" ON public.squad_members FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "squad_members_admin_all" ON public.squad_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Health scores table
CREATE TABLE public.health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  evaluated_by uuid NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  resultado_percebido integer NOT NULL DEFAULT 0 CHECK (resultado_percebido >= 0 AND resultado_percebido <= 100),
  alinhamento_estrategico integer NOT NULL DEFAULT 0 CHECK (alinhamento_estrategico >= 0 AND alinhamento_estrategico <= 100),
  comunicacao_atendimento integer NOT NULL DEFAULT 0 CHECK (comunicacao_atendimento >= 0 AND comunicacao_atendimento <= 100),
  qualidade_entregas integer NOT NULL DEFAULT 0 CHECK (qualidade_entregas >= 0 AND qualidade_entregas <= 100),
  satisfacao_geral integer NOT NULL DEFAULT 0 CHECK (satisfacao_geral >= 0 AND satisfacao_geral <= 100),
  comentario_resultado text,
  comentario_alinhamento text,
  comentario_comunicacao text,
  comentario_qualidade text,
  comentario_satisfacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, month, year)
);

ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_scores_select_auth" ON public.health_scores FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "health_scores_admin_all" ON public.health_scores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER squads_updated_at BEFORE UPDATE ON public.squads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER health_scores_updated_at BEFORE UPDATE ON public.health_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
