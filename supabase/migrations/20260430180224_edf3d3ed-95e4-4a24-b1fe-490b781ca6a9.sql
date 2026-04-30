ALTER TABLE public.pm_tasks
ADD COLUMN IF NOT EXISTS periodic_stage_key text;

COMMENT ON COLUMN public.pm_tasks.periodic_stage_key IS
'Quando preenchido, indica que a tarefa usa uma etapa periódica customizada (scoring_config.stage = custom_*). Não entra no fluxo padrão Planejamento->PDF.';

CREATE INDEX IF NOT EXISTS idx_pm_tasks_periodic_stage_key
ON public.pm_tasks (periodic_stage_key)
WHERE periodic_stage_key IS NOT NULL;