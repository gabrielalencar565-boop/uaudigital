-- Quem mandou a tarefa para Alteração (a pessoa que revisou): só ela edita os motivos escritos em cada subtarefa.
alter table public.pm_tasks add column if not exists alteration_requested_by uuid;

-- Tarefas que já estão em Alteração: pega quem fez a última mudança para essa etapa no histórico.
update public.pm_tasks t
set alteration_requested_by = x.created_by
from (
  select distinct on (a.entity_id) a.entity_id, a.created_by
  from public.pm_activity_log a
  where a.entity_type = 'task' and a.metadata->>'stage_current' = 'alteracoes' and a.created_by is not null
  order by a.entity_id, a.created_at desc
) x
where t.id = x.entity_id and t.stage_current = 'alteracoes' and t.alteration_requested_by is null and t.parent_task_id is null;
