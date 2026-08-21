-- Mirror of trg_complete_agendamento_on_scheduled (see 20260821180000): quando a publicação é
-- desagendada (instagram_scheduled volta pra false — botão individual "Cancelar agendamento" ou
-- bulk "Desmarcar agendamento"), reverte a conclusão automática da tarefa de "agendamento" e
-- desfaz a sincronização com Magic Number e Agenda, do mesmo jeito que a conclusão foi feita.
--
-- Só reverte tarefas que estão em 'entrega'/'concluido' com essa linhagem — se a etapa já tiver
-- sido concluída manualmente na Gestão antes de qualquer agendamento (ou já revertida), o estado
-- fica indistinguível do que este trigger criou; nesse caso o "desagendar" também reverte, o que
-- espelha a mesma granularidade já aceita para completar (uma ação afeta o grupo inteiro que
-- compartilha a tarefa de agendamento).
create or replace function public.uncomplete_agendamento_on_publication_unscheduled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pdf_container_id uuid;
  v_lineage_root_id uuid;
  v_target_id uuid;
  v_client_id uuid;
  v_due_date date;
  v_is_extra boolean;
  v_periodic_key text;
  v_snapshot_stage_key text;
  v_year int;
  v_month int;
  v_magic2_client_id uuid;
  v_cycle_id uuid;
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

  select id, client_id, due_date, is_extra_demand, periodic_stage_key
    into v_target_id, v_client_id, v_due_date, v_is_extra, v_periodic_key
  from public.pm_tasks
  where (id = v_lineage_root_id or origin_task_id = v_lineage_root_id)
    and stage_current = 'entrega'
    and status_global = 'concluido'
    and parent_task_id is null
    and deleted_at is null
  limit 1;

  if v_target_id is null then
    return new;
  end if;

  update public.pm_tasks
  set stage_current = 'agendamento',
      status_global = 'backlog'
  where (id = v_target_id or parent_task_id = v_target_id)
    and deleted_at is null;

  v_snapshot_stage_key := coalesce(v_periodic_key, 'agendamento');

  delete from public.tasks
  where description like ('pm:' || v_target_id::text || ':' || v_snapshot_stage_key || ':%');

  if coalesce(v_is_extra, false) = false and v_periodic_key is null and v_due_date is not null then
    v_year := extract(year from v_due_date)::int;
    v_month := extract(month from v_due_date)::int;

    select l.magic2_client_id into v_magic2_client_id
    from public.magic2_client_links l
    where l.agenda_client_id = v_client_id
    limit 1;

    if v_magic2_client_id is not null then
      select id into v_cycle_id
      from public.magic2_cycles
      where client_id = v_magic2_client_id and year = v_year and month = v_month
      limit 1;

      if v_cycle_id is not null then
        update public.magic2_cycle_stages
        set completed = false, completed_at = null, completed_by = null, updated_at = now()
        where cycle_id = v_cycle_id and stage = 'agendamento' and completed = true;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_uncomplete_agendamento_on_unscheduled on public.calendar_publications;

create trigger trg_uncomplete_agendamento_on_unscheduled
  after update of instagram_scheduled on public.calendar_publications
  for each row
  when (not new.instagram_scheduled and old.instagram_scheduled)
  execute function public.uncomplete_agendamento_on_publication_unscheduled();
