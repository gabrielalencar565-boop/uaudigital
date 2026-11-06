-- O tipo do conteúdo no Cronograma deixa de depender só da etiqueta. Sem etiqueta que o defina (tipo "outro", que não é mais
-- oferecido), o sistema olha a mídia final da tarefa: tem vídeo → Reels; várias fotos → Carrossel; uma foto → Post.
-- A etiqueta continua mandando (ela já define o tipo quando a publicação nasce) e quem escolheu um tipo à mão não é mexido.

create or replace function public.pm_infer_content_type_from_media(p_task uuid)
returns public.publication_content_type
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.pm_attachments a where a.task_id = p_task and a.category = 'final' and a.file_type like 'video/%')
      then 'reel'::public.publication_content_type
    when (select count(*) from public.pm_attachments a where a.task_id = p_task and a.category = 'final' and a.file_type like 'image/%') > 1
      then 'carrossel'::public.publication_content_type
    when (select count(*) from public.pm_attachments a where a.task_id = p_task and a.category = 'final' and a.file_type like 'image/%') = 1
      then 'post'::public.publication_content_type
    else null
  end;
$$;
revoke execute on function public.pm_infer_content_type_from_media(uuid) from public, anon, authenticated;

-- Tarefa "Capa" só guarda arte de capa: não é um post
create or replace function public.pm_task_is_capa(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pm_tasks t
    cross join lateral unnest(coalesce(t.tags, '{}'::text[])) as tag
    where t.id = p_task and lower(btrim(split_part(tag, ':', 1))) = 'capa'
  );
$$;
revoke execute on function public.pm_task_is_capa(uuid) from public, anon, authenticated;

-- Publicação que nasce sem tipo definido já olha a mídia que a tarefa tem
create or replace function public.calendar_publications_infer_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v public.publication_content_type;
begin
  if new.content_type = 'outro' and new.task_id is not null and not public.pm_task_is_capa(new.task_id) then
    v := public.pm_infer_content_type_from_media(new.task_id);
    if v is not null then new.content_type := v; end if;
  end if;
  return new;
end;
$fn$;
revoke execute on function public.calendar_publications_infer_type() from public, anon, authenticated;
create trigger calendar_publications_infer_type before insert on public.calendar_publications
for each row execute function public.calendar_publications_infer_type();

-- Mídia final anexada depois: a publicação ainda sem tipo passa a ter o tipo da mídia
create or replace function public.pm_attachments_infer_publication_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v public.publication_content_type;
begin
  if new.category <> 'final' or new.task_id is null or public.pm_task_is_capa(new.task_id) then
    return null;
  end if;
  v := public.pm_infer_content_type_from_media(new.task_id);
  if v is not null then
    update public.calendar_publications
    set content_type = v
    where task_id = new.task_id and content_type = 'outro' and deleted_at is null and instagram_status is distinct from 'published';
  end if;
  return null;
end;
$fn$;
revoke execute on function public.pm_attachments_infer_publication_type() from public, anon, authenticated;
create trigger pm_attachments_infer_publication_type after insert on public.pm_attachments
for each row execute function public.pm_attachments_infer_publication_type();

-- As que já estão sem tipo e já têm mídia
update public.calendar_publications cp
set content_type = public.pm_infer_content_type_from_media(cp.task_id)
where cp.content_type = 'outro' and cp.deleted_at is null and cp.instagram_status is distinct from 'published'
  and cp.task_id is not null and not public.pm_task_is_capa(cp.task_id)
  and public.pm_infer_content_type_from_media(cp.task_id) is not null;
