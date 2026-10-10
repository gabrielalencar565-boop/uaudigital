-- More {variables} for the editable messages: who mentioned you ({autor}) and the client ({cliente}).

create or replace function public.pm_tasks_push_on_assign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  txt record;
  v_client text;
begin
  if new.parent_task_id is not null then return new; end if;
  if new.is_draft is true then return new; end if;
  if new.assignee_id is null then return new; end if;
  if new.deleted_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.assignee_id is not distinct from new.assignee_id then return new; end if;
  if not public.notification_enabled(new.agency_id, 'task_assigned') then return new; end if;
  select c.name into v_client from public.clients c where c.id = new.client_id;
  select * into txt from public.notification_text(
    new.agency_id, 'task_assigned',
    jsonb_build_object('tarefa', coalesce(new.title, ''), 'cliente', coalesce(v_client, ''))
  );
  perform public.internal_push(new.assignee_id, txt.title, txt.body, new.id, 'task_assigned');
  return new;
end;
$$;

create or replace function public.pm_comments_push_on_mention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mentioned_id uuid;
  m record;
  txt record;
  v_author text;
begin
  if not public.notification_enabled(new.agency_id, 'mention') then return new; end if;
  select tm.display_name into v_author from public.team_members tm where tm.user_id = new.author_id limit 1;
  select * into txt from public.notification_text(
    new.agency_id, 'mention',
    jsonb_build_object('texto', btrim(regexp_replace(new.content, '@[a-f0-9-]{36}', '', 'g')), 'autor', coalesce(v_author, 'Alguém'))
  );
  for m in select (regexp_matches(new.content, '@([a-f0-9-]{36})', 'g'))[1] as uid loop
    begin
      mentioned_id := m.uid::uuid;
    exception when others then continue;
    end;
    if mentioned_id = new.author_id then continue; end if;
    perform public.internal_push(mentioned_id, txt.title, txt.body, new.task_id, 'mention');
  end loop;
  return new;
end;
$$;

create or replace function public.calendar_publications_push_on_client_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignee uuid;
  v_title text;
  v_client text;
  txt record;
begin
  if new.client_responded_at is not distinct from old.client_responded_at then return new; end if;
  if new.status not in ('aprovada', 'alteracao_solicitada') then return new; end if;
  if not public.notification_enabled(new.agency_id, 'client_reply') then return new; end if;
  select t.assignee_id, t.title into v_assignee, v_title from public.pm_tasks t where t.id = new.task_id;
  if v_assignee is null then return new; end if;
  select c.name into v_client
  from public.publication_calendars pc join public.clients c on c.id = pc.client_id
  where pc.id = new.calendar_id;
  select * into txt from public.notification_text(
    new.agency_id, 'client_reply',
    jsonb_build_object(
      'acao', case when new.status = 'aprovada' then 'aprovou ✅' else 'pediu alteração ✏️' end,
      'texto', case when new.status = 'aprovada' then coalesce(v_title, 'Publicação') else coalesce(new.client_feedback, coalesce(v_title, 'Publicação')) end,
      'cliente', coalesce(v_client, '')
    )
  );
  perform public.internal_push(v_assignee, txt.title, txt.body, new.task_id, 'client_reply');
  return new;
end;
$$;

-- Sample data for the "Enviar teste" button
create or replace function public.send_test_push(p_key text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  txt record;
  v_sample jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_key is null then
    perform public.internal_push(auth.uid(), 'Teste de notificação 🔔', 'Os avisos estão chegando aqui.');
    return;
  end if;
  v_sample := case p_key
    when 'unscheduled_posts' then '{"total": 20, "atrasados": 6, "resumo": "20 sem agendar · 6 atrasados"}'::jsonb
    when 'client_reply' then '{"acao": "pediu alteração ✏️", "texto": "Quero só mudar a última foto", "cliente": "Doce Rio"}'::jsonb
    when 'capture_request' then '{"empresa": "Doce Rio", "data": "22/10", "periodo": "tarde"}'::jsonb
    when 'mention' then '{"texto": "Dá uma olhada nesse post?", "autor": "Ana Beatriz"}'::jsonb
    when 'task_assigned' then '{"tarefa": "[Doce Rio] - Design - Outubro", "cliente": "Doce Rio"}'::jsonb
    else '{}'::jsonb
  end;
  select * into txt from public.notification_text(public.current_agency_id(), p_key, v_sample);
  perform public.internal_push(auth.uid(), txt.title, txt.body);
end;
$$;

revoke execute on function public.pm_tasks_push_on_assign() from public, anon, authenticated;
revoke execute on function public.pm_comments_push_on_mention() from public, anon, authenticated;
revoke execute on function public.calendar_publications_push_on_client_reply() from public, anon, authenticated;
revoke execute on function public.send_test_push(text) from public, anon;
grant execute on function public.send_test_push(text) to authenticated;
