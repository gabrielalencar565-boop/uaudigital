-- Demandas extras: o que acontece quando uma demanda extra é concluída em cada etapa (editado em Configurações → Agência → Fluxo de etapas).
-- { "<etapa>": "deliver" | "complete" | "flow" }. Etapa sem regra usa o padrão do app (planejamento segue o fluxo; as demais vão para Entregue).
alter table public.pm_stage_flows add column if not exists extra_rules jsonb not null default '{}'::jsonb;
