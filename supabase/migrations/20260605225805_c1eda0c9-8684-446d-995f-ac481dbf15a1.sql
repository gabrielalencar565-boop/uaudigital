ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS appears_in_financial boolean NOT NULL DEFAULT true;

UPDATE public.clients
  SET appears_in_financial = false
  WHERE lower(name) = 'uau digital';

DELETE FROM public.financial_revenues
  WHERE client_id IN (SELECT id FROM public.clients WHERE appears_in_financial = false);

DELETE FROM public.financial_clients
  WHERE id IN (SELECT id FROM public.clients WHERE appears_in_financial = false);