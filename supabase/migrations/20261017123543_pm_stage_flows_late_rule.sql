-- Regra do prazo da próxima etapa quando a anterior foi concluída com atraso (editada em Fluxos → Etapa concluída com atraso):
-- 'keep' = soma ao prazo que a etapa anterior tinha (como sempre foi); 'from_today' = soma a partir de hoje.
alter table public.pm_stage_flows add column if not exists late_rule text not null default 'keep' check (late_rule in ('keep', 'from_today'));
