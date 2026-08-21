-- Quando uma publicação do Cronograma é marcada como agendada (instagram_scheduled
-- vira true — seja pelo botão individual, "Agendar publicações" em massa, ou "Forçar
-- agendamento"), a tarefa de "agendamento" correspondente no pipeline (a que foi criada
-- automaticamente ao concluir o PDF) deve ser completada automaticamente, com a mesma
-- sincronização que uma conclusão manual na Gestão teria: Magic Number e Agenda.
--
-- Não existe coluna de lineage direta "PDF -> agendamento" (doAdvance clona pra uma leaf
-- nova sem guardar mapeamento). O jeito de achar é: resolver o container do PDF (subir de
-- leaf pra parent_task_id se for filha), pegar a raiz da linhagem inteira (origin_task_id),
-- e procurar o container de agendamento (parent_task_id is null) que compartilha essa raiz.
create or replace function public.complete_agendamento_on_publication_scheduled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pdf_container_id uuid;
  v_lineage_root_id uuid;
  v_agendamento_id uuid;
begin
  select coalesce(parent_task_id, id)
    into v_pdf_container_id
  from public.pm_tasks
  where id = new.task_id;

  if v_pdf_container_id is null then
    return new;
  end if;

  select coalesce(origin_task_id, id)
    into v_lineage_root_id
  from public.pm_tasks
  where id = v_pdf_container_id;

  select id
    into v_agendamento_id
  from public.pm_tasks
  where (id = v_lineage_root_id or origin_task_id = v_lineage_root_id)
    and stage_current = 'agendamento'
    and parent_task_id is null
    and deleted_at is null
    and status_global <> 'concluido'
  limit 1;

  if v_agendamento_id is null then
    return new;
  end if;

  update public.pm_tasks
  set stage_current = 'entrega',
      status_global = 'concluido'
  where (id = v_agendamento_id or parent_task_id = v_agendamento_id)
    and deleted_at is null;

  perform public.pm_sync_stage_completion(v_agendamento_id, 'agendamento', auth.uid(), null);

  return new;
end;
$$;

drop trigger if exists trg_complete_agendamento_on_scheduled on public.calendar_publications;

create trigger trg_complete_agendamento_on_scheduled
  after update of instagram_scheduled on public.calendar_publications
  for each row
  when (new.instagram_scheduled and not old.instagram_scheduled)
  execute function public.complete_agendamento_on_publication_scheduled();
