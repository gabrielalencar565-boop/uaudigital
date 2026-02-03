-- Adiciona coluna para marcar tarefas como demanda extra
ALTER TABLE public.tasks 
ADD COLUMN is_extra_demand boolean NOT NULL DEFAULT false;

-- Adiciona comentário explicativo
COMMENT ON COLUMN public.tasks.is_extra_demand IS 'Quando true, a tarefa não sincroniza com o Magic Number, apenas afeta o desempenho';