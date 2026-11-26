-- Legenda escrita no post, dentro da tarefa. Cada etapa cria CÓPIAS do post (ligadas por post_key; tarefa avulsa, por origin_task_id),
-- e sem isto a legenda ficava para trás. O Cronograma já copia pm_tasks.caption quando o post chega nele.

-- 1) Cópia nova nasce com a legenda mais recente do mesmo post.
create or replace function public.pm_tasks_inherit_caption()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caption text;
begin
  if coalesce(new.caption, '') <> '' then return new; end if;
  if new.post_key is not null then
    select p.caption into v_caption from public.pm_tasks p
     where (p.id = new.post_key or p.post_key = new.post_key)
       and p.client_id is not distinct from new.client_id and p.deleted_at is null and coalesce(p.caption, '') <> ''
     order by p.updated_at desc limit 1;
  elsif new.parent_task_id is null and new.origin_task_id is not null and new.post_type in ('video', 'design') then
    select p.caption into v_caption from public.pm_tasks p
     where (p.id = new.origin_task_id or p.origin_task_id = new.origin_task_id)
       and p.parent_task_id is null and p.post_type = new.post_type
       and p.client_id is not distinct from new.client_id and p.deleted_at is null and coalesce(p.caption, '') <> ''
     order by p.updated_at desc limit 1;
  end if;
  if v_caption is not null then new.caption := v_caption; end if;
  return new;
end;
$$;

drop trigger if exists pm_tasks_inherit_caption on public.pm_tasks;
create trigger pm_tasks_inherit_caption before insert on public.pm_tasks
  for each row execute function public.pm_tasks_inherit_caption();

-- 2) É UMA legenda só. Mudou no post: as outras cópias do post e a publicação no Cronograma ficam iguais (publicado ou publicando não é mexido).
create or replace function public.pm_tasks_propagate_caption()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key uuid := coalesce(new.post_key, new.id);
begin
  if pg_trigger_depth() > 1 then return null; end if;
  update public.pm_tasks
     set caption = new.caption
   where (id = v_key or post_key = v_key) and id <> new.id and deleted_at is null
     and client_id is not distinct from new.client_id and caption is distinct from new.caption;
  update public.calendar_publications cp
     set caption = new.caption
    from public.pm_tasks t
   where cp.task_id = t.id and (t.id = v_key or t.post_key = v_key)
     and t.client_id is not distinct from new.client_id
     and cp.deleted_at is null and cp.instagram_status in ('not_published', 'pending', 'failed')
     and cp.caption is distinct from new.caption;
  return null;
end;
$$;

drop trigger if exists pm_tasks_propagate_caption on public.pm_tasks;
create trigger pm_tasks_propagate_caption after update of caption on public.pm_tasks
  for each row when (old.caption is distinct from new.caption)
  execute function public.pm_tasks_propagate_caption();

-- 3) O caminho de volta: legenda escrita no Cronograma vai para o post em todas as etapas.
create or replace function public.calendar_publication_caption_to_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key uuid;
  v_client uuid;
begin
  if pg_trigger_depth() > 1 then return null; end if; -- veio da própria tarefa: nada a devolver
  if tg_op = 'INSERT' then
    if coalesce(new.caption, '') = '' then return null; end if; -- publicação nova sem legenda não apaga a do post
  elsif new.caption is not distinct from old.caption then
    return null;
  end if;
  select coalesce(t.post_key, t.id), t.client_id into v_key, v_client from public.pm_tasks t where t.id = new.task_id;
  if v_key is null then return null; end if;
  update public.pm_tasks
     set caption = new.caption
   where (id = v_key or post_key = v_key or id = new.task_id) and deleted_at is null
     and client_id is not distinct from v_client and caption is distinct from new.caption;
  return null;
end;
$$;

drop trigger if exists calendar_publication_caption_to_task on public.calendar_publications;
create trigger calendar_publication_caption_to_task after insert or update of caption on public.calendar_publications
  for each row execute function public.calendar_publication_caption_to_task();

revoke all on function public.pm_tasks_inherit_caption(), public.pm_tasks_propagate_caption(), public.calendar_publication_caption_to_task() from public, anon, authenticated;
