-- A etapa "Alterações" deixa de existir no Magic Number (checklist, painel, metas e análise mensal passam a ter 6 etapas).
-- Guarda uma cópia das linhas antigas, apaga as linhas da etapa e impede que novas sejam criadas (as funções do banco que abrem o ciclo
-- inserem todos os valores do enum magic2_stage_type, inclusive 'alteracoes'; o gatilho descarta essa linha).
create table if not exists public.magic2_cycle_stages_alteracoes_backup as
  select * from public.magic2_cycle_stages where stage = 'alteracoes';
alter table public.magic2_cycle_stages_alteracoes_backup enable row level security;

delete from public.magic2_cycle_stages where stage = 'alteracoes';

create or replace function public.magic2_skip_alteracoes() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.stage = 'alteracoes' then return null; end if;
  return new;
end $$;

drop trigger if exists trg_magic2_skip_alteracoes on public.magic2_cycle_stages;
create trigger trg_magic2_skip_alteracoes before insert on public.magic2_cycle_stages
  for each row execute function public.magic2_skip_alteracoes();
