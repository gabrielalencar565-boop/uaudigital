-- Lixeira do Cronograma: remover uma publicação do calendário não apaga mais a linha, só marca quem removeu e quando (deleted_at/deleted_by).
-- Dá para restaurar no mesmo dia, com legenda, capa, horário e tudo como estava.
alter table public.calendar_publications add column if not exists deleted_by uuid;

create index if not exists calendar_publications_removed_idx
  on public.calendar_publications (calendar_id, deleted_at desc)
  where deleted_at is not null and deleted_by is not null;

-- Quando a tarefa volta para a etapa PDF (ex.: "Enviar todas ao Cronograma") e a publicação dela foi removida por uma pessoa, em vez de
-- ficar sem nada (a linha removida ainda ocupa a tarefa), a publicação removida volta como estava.
create or replace function pg_temp.patch_fn(p_sig text, p_old text, p_new text)
returns void
language plpgsql
as $fn$
declare d text;
begin
  d := pg_get_functiondef(p_sig::regprocedure);
  if position(p_old in d) = 0 then raise exception 'patch em %: trecho não encontrado', p_sig; end if;
  execute replace(d, p_old, p_new);
end;
$fn$;

select pg_temp.patch_fn('public.pm_task_pdf_stage_to_calendar()',
$old$  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id) THEN
    RETURN NEW;
  END IF;
$old$,
$new$  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id AND deleted_at IS NULL) THEN
    RETURN NEW;
  END IF;

  -- removida por uma pessoa do Cronograma (lixeira): volta como estava
  UPDATE public.calendar_publications SET deleted_at = NULL, deleted_by = NULL
  WHERE task_id = NEW.id AND deleted_at IS NOT NULL AND deleted_by IS NOT NULL;
  IF FOUND THEN
    RETURN NEW;
  END IF;

  -- o resto (publicação que saiu junto com a tarefa apagada) segue como antes
  IF EXISTS (SELECT 1 FROM public.calendar_publications WHERE task_id = NEW.id) THEN
    RETURN NEW;
  END IF;
$new$);
