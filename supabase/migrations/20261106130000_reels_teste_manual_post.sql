-- Etiqueta "Reels Teste": conteúdo que vai para o Cronograma para o cliente ver, mas é postado à mão (não passa pelo agendamento em lote).
--   calendar_publications.manual_post → marca a publicação como "postagem manual"
-- Ela continua podendo ser agendada uma a uma. "Marcar como postado" é o "Marcar como publicado" que já existia (instagram_status = published,
-- sem id do Instagram): para publicação manual ele também conclui a etapa Agendamento da tarefa, e desfazer reabre.

alter table public.calendar_publications add column if not exists manual_post boolean not null default false;

-- A etiqueta "Reels Teste" é um Reels
do $patch$
declare
  d text;
begin
  d := pg_get_functiondef('public.pm_resolve_content_type(text[],text)'::regprocedure);
  if position($old$WHEN 'reel' THEN 'reel'::public.publication_content_type$old$ in d) = 0 then
    raise exception 'pm_resolve_content_type: trecho não encontrado';
  end if;
  d := replace(d, $old$WHEN 'reel' THEN 'reel'::public.publication_content_type$old$,
    $new$WHEN 'reel' THEN 'reel'::public.publication_content_type
      WHEN 'reels teste' THEN 'reel'::public.publication_content_type$new$);
  execute d;
end;
$patch$;

-- A publicação nasce marcada como manual quando a tarefa (ou a tarefa-mãe) tem a etiqueta "Reels Teste"
create or replace function public.pm_task_has_reels_teste(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pm_tasks t
    cross join lateral unnest(coalesce(t.tags, '{}'::text[])) as tag
    where (t.id = p_task or t.id = (select x.parent_task_id from public.pm_tasks x where x.id = p_task))
      and lower(btrim(split_part(tag, ':', 1))) = 'reels teste'
  );
$$;
revoke execute on function public.pm_task_has_reels_teste(uuid) from public, anon, authenticated;

create or replace function public.calendar_publications_set_manual_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not new.manual_post and new.task_id is not null and public.pm_task_has_reels_teste(new.task_id) then
    new.manual_post := true;
  end if;
  return new;
end;
$fn$;
revoke execute on function public.calendar_publications_set_manual_post() from public, anon, authenticated;
create trigger calendar_publications_set_manual_post before insert on public.calendar_publications
for each row execute function public.calendar_publications_set_manual_post();

-- Quem põe ou tira a etiqueta depois que a publicação já existe também muda a marcação
create or replace function public.pm_tasks_sync_manual_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  update public.calendar_publications cp
  set manual_post = public.pm_task_has_reels_teste(new.id)
  where cp.task_id = new.id and cp.manual_post is distinct from public.pm_task_has_reels_teste(new.id);
  return null;
end;
$fn$;
revoke execute on function public.pm_tasks_sync_manual_post() from public, anon, authenticated;
create trigger pm_tasks_sync_manual_post after update of tags on public.pm_tasks
for each row when (old.tags is distinct from new.tags)
execute function public.pm_tasks_sync_manual_post();

update public.calendar_publications cp set manual_post = true
where not cp.manual_post and cp.task_id is not null and public.pm_task_has_reels_teste(cp.task_id);

-- Marcar como postado (publicação manual) conclui o Agendamento da tarefa; desfazer reabre
create trigger trg_complete_agendamento_on_manual_post
  after update of instagram_status on public.calendar_publications
  for each row
  when (new.manual_post and new.instagram_status = 'published' and old.instagram_status is distinct from 'published')
  execute function public.complete_agendamento_on_publication_scheduled();

create trigger trg_uncomplete_agendamento_on_manual_unpost
  after update of instagram_status on public.calendar_publications
  for each row
  when (new.manual_post and old.instagram_status = 'published' and new.instagram_status is distinct from 'published')
  execute function public.uncomplete_agendamento_on_publication_unscheduled();

-- O aviso de "posts sem agendar" não conta postagem manual
do $patch$
declare
  d text;
begin
  d := pg_get_functiondef('public.unscheduled_post_summary()'::regprocedure);
  if position('and cp.instagram_scheduled is not true' in d) = 0 then
    raise exception 'unscheduled_post_summary: trecho não encontrado';
  end if;
  d := replace(d, 'and cp.instagram_scheduled is not true', E'and not cp.manual_post\n    and cp.instagram_scheduled is not true');
  execute d;
end;
$patch$;
