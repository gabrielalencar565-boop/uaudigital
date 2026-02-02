-- Fase 2: Adiciona coluna is_active para congelar clientes sem deletar

ALTER TABLE public.clients
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.clients.is_active IS 
  'Cliente ativo aparece no checklist/agenda. Inativo fica apenas no admin para consulta histórica.';