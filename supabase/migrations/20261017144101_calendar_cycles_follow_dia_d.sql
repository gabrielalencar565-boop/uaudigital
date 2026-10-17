-- O ciclo do Cronograma volta a seguir o Dia D da agência (Configurações → Agência → Dia D; 27 por padrão): com Dia D = 27, o ciclo de outubro
-- vai de 28/09 a 27/10 e do dia 28 em diante é outro calendário. O dia não fica mais fixo no banco: cada agência usa o seu.
create or replace function public.agency_cycle_day(p_agency uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce((select s.magic_number_day from public.app_settings s where s.agency_id = p_agency), 27);
$fn$;
revoke execute on function public.agency_cycle_day(uuid) from public, anon;
grant execute on function public.agency_cycle_day(uuid) to authenticated, service_role;

create or replace function public.calendar_cycle_bounds(_ref date, _day integer)
returns table(cycle_start date, cycle_end date)
language sql
immutable
set search_path to 'public'
as $fn$
  select
    case when extract(day from _ref) > _day then date_trunc('month', _ref)::date + _day
         else (date_trunc('month', _ref) - interval '1 month')::date + _day end as cycle_start,
    case when extract(day from _ref) > _day then (date_trunc('month', _ref) + interval '1 month')::date + (_day - 1)
         else date_trunc('month', _ref)::date + (_day - 1) end as cycle_end;
$fn$;

-- a forma de uma chamada sem o dia continua existindo, com o padrão 27
create or replace function public.calendar_cycle_bounds(_ref date)
returns table(cycle_start date, cycle_end date)
language sql
immutable
set search_path to 'public'
as $fn$
  select * from public.calendar_cycle_bounds(_ref, 27);
$fn$;

create or replace function pg_temp.patch_fn(p_sig text, p_old text, p_new text)
returns void
language plpgsql
as $fn$
declare d text;
begin
  d := pg_get_functiondef(p_sig::regprocedure);
  if position(p_old in d) = 0 then raise exception 'patch em %: trecho não encontrado: %', p_sig, p_old; end if;
  execute replace(d, p_old, p_new);
end;
$fn$;

select pg_temp.patch_fn('public.ensure_publication_calendar(uuid,date)', 'calendar_cycle_bounds(p_date)', 'calendar_cycle_bounds(p_date, public.agency_cycle_day(v_agency))');
select pg_temp.patch_fn('public.calendar_publications_refile_by_date()', 'calendar_cycle_bounds(new.publish_date)', 'calendar_cycle_bounds(new.publish_date, public.agency_cycle_day(v_agency))');
select pg_temp.patch_fn('public.pm_task_pdf_stage_to_calendar()', 'calendar_cycle_bounds(COALESCE(NEW.posting_date, CURRENT_DATE))', 'calendar_cycle_bounds(COALESCE(NEW.posting_date, CURRENT_DATE), public.agency_cycle_day(NEW.agency_id))');

-- os calendários de mês (01 a 30/31) viram o ciclo do Dia D da agência: outubro = 28/09 a 27/10
update public.publication_calendars pc
set cycle_start = (date_trunc('month', pc.cycle_start) - interval '1 month')::date + public.agency_cycle_day(pc.agency_id),
    cycle_end = date_trunc('month', pc.cycle_start)::date + (public.agency_cycle_day(pc.agency_id) - 1)
where extract(day from pc.cycle_start) = 1;

-- cada publicação vai para o calendário do ciclo da data dela (o gatilho trg_calendar_publications_refile_by_date faz o trabalho)
update public.calendar_publications cp
set publish_date = cp.publish_date
from public.publication_calendars pc
where pc.id = cp.calendar_id and cp.deleted_at is null and cp.publish_date is not null
  and (cp.publish_date < pc.cycle_start or cp.publish_date > pc.cycle_end);
