ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS end_reason text;
ALTER TABLE public.financial_clients ADD COLUMN IF NOT EXISTS end_reason text;