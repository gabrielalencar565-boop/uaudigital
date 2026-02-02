-- Desativa o trigger de pontuação automática (preserva código para reativação futura)
DROP TRIGGER IF EXISTS tasks_sync_all_scores ON public.tasks;

-- Adiciona comentário documentando a desativação
COMMENT ON FUNCTION public.recompute_all_scores(_user_id uuid, _year integer, _month integer) 
IS 'DESATIVADO em 2026-02-02. Função preservada para possível reativação futura. 
Pontuação agora é preenchida manualmente pelo admin via UI.';

COMMENT ON FUNCTION public.tasks_sync_all_scores() 
IS 'DESATIVADO em 2026-02-02. Trigger removido - função preservada para reativação futura.';