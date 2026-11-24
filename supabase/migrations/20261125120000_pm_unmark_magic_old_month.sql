-- Mudar o mês do Magic Number (ou a entrega) de uma etapa JÁ concluída refaz a pontuação e marca o check no mês novo (pm_resync_correction),
-- mas o check do mês ANTIGO ficava marcado. Esta função desmarca a etapa no mês antigo quando nenhuma outra tarefa concluída da mesma
-- etapa e cliente conta nele. Só para etapas que têm tarefa-registro de pontuação (planejamento, design e vídeo): as outras (captação,
-- cronograma, agendamento) são marcadas por outros caminhos e não podem ser desmarcadas por contagem.
create or replace function public.pm_unmark_magic_old_month(_pm_task_id uuid, _old_month date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client uuid;
  v_stage text;
  v_stage_type public.magic2_stage_type;
  v_m2 uuid;
  v_cycle uuid;
  v_other int;
begin
  if not public._caller_can_access_pm_task(_pm_task_id) then
    raise exception 'forbidden';
  end if;
  select client_id, stage_current into v_client, v_stage from public.pm_tasks where id = _pm_task_id;
  if v_client is null or v_stage not in ('planejamento', 'design', 'edicao_videos') then return; end if;
  begin
    v_stage_type := v_stage::public.magic2_stage_type;
  exception when others then
    return;
  end;
  select l.magic2_client_id into v_m2 from public.magic2_client_links l where l.agenda_client_id = v_client limit 1;
  if v_m2 is null then return; end if;
  select id into v_cycle from public.magic2_cycles
   where client_id = v_m2 and year = extract(year from _old_month)::int and month = extract(month from _old_month)::int limit 1;
  if v_cycle is null then return; end if;
  select count(*) into v_other from public.tasks t
   where t.client_id = v_client and t.stage::text = v_stage and t.status = 'concluido' and t.deleted_at is null
     and coalesce(t.is_extra_demand, false) = false
     and date_trunc('month', coalesce(t.reference_month, t.due_date)::timestamp) = date_trunc('month', _old_month::timestamp);
  if v_other = 0 then
    update public.magic2_cycle_stages
       set completed = false, completed_at = null, completed_by = null, updated_at = now()
     where cycle_id = v_cycle and stage = v_stage_type;
  end if;
end;
$$;
revoke all on function public.pm_unmark_magic_old_month(uuid, date) from public, anon;
grant execute on function public.pm_unmark_magic_old_month(uuid, date) to authenticated;
