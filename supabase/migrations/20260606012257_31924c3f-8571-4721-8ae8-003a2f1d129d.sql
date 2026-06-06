
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.reward_levels ADD COLUMN IF NOT EXISTS icon TEXT;

CREATE TABLE IF NOT EXISTS public.xp_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  xp_value INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Produtividade',
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_criteria TO authenticated;
GRANT ALL ON public.xp_criteria TO service_role;

ALTER TABLE public.xp_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xp_criteria_select_auth" ON public.xp_criteria
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "xp_criteria_admin_all" ON public.xp_criteria
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.update_xp_criteria_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_xp_criteria_updated_at ON public.xp_criteria;
CREATE TRIGGER trg_xp_criteria_updated_at
  BEFORE UPDATE ON public.xp_criteria
  FOR EACH ROW EXECUTE FUNCTION public.update_xp_criteria_updated_at();

INSERT INTO public.xp_criteria (name, description, xp_value, category, icon, sort_order) VALUES
  ('Tarefa entregue no prazo', 'Concluir uma tarefa dentro da data limite estabelecida', 10, 'Produtividade', 'CheckCircle2', 1),
  ('Bônus de excelência', 'Reconhecimento por trabalho de qualidade excepcional', 25, 'Qualidade', 'Star', 2),
  ('Padrão de qualidade UAU', 'Entrega seguindo todos os padrões de qualidade UAU', 15, 'Qualidade', 'Sparkles', 3),
  ('Squad Destaque', 'Reconhecimento como destaque do squad no mês', 50, 'Bônus', 'Trophy', 4),
  ('Vídeo Destaque', 'Vídeo selecionado como destaque do mês', 30, 'Bônus', 'Video', 5),
  ('Comprometimento', 'Demonstração consistente de comprometimento com as entregas', 10, 'Produtividade', 'Heart', 6),
  ('Ambiente organizado', 'Manter o ambiente de trabalho e arquivos organizados', 5, 'Produtividade', 'FolderCheck', 7),
  ('Aprendizado contínuo', 'Buscar evolução constante e novos aprendizados', 10, 'Bônus', 'GraduationCap', 8),
  ('Atraso na entrega', 'Tarefa entregue após a data limite', -5, 'Penalidades', 'AlertTriangle', 9)
ON CONFLICT DO NOTHING;
