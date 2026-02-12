
-- Table for MRR movements (entries and exits)
CREATE TABLE public.mrr_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mrr_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mrr_movements_admin_all" ON public.mrr_movements
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_mrr_movements_updated_at
  BEFORE UPDATE ON public.mrr_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
