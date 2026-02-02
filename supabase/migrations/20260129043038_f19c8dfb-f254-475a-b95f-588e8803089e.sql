-- Participação por mês: clientes podem ser ativados/desativados por ciclo mensal.
-- Isso permite remover a partir de um mês, preservando meses anteriores.

ALTER TABLE public.client_cycles
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Índice para filtrar rapidamente por mês/ano na UI
CREATE INDEX IF NOT EXISTS idx_client_cycles_year_month_active
ON public.client_cycles (year, month, is_active);

-- (Opcional) índice para lookup por cliente
CREATE INDEX IF NOT EXISTS idx_client_cycles_client_year_month
ON public.client_cycles (client_id, year, month);
