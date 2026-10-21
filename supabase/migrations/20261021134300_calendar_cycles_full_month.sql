-- Cópia de segurança do que muda (calendários e em qual calendário cada publicação estava), para poder desfazer.
create table if not exists public.zz_bkp_calendars_20261021 as select * from public.publication_calendars;
create table if not exists public.zz_bkp_cal_publications_20261021 as select id, calendar_id, publish_date from public.calendar_publications;
alter table public.zz_bkp_calendars_20261021 enable row level security;
alter table public.zz_bkp_cal_publications_20261021 enable row level security;
revoke all on public.zz_bkp_calendars_20261021, public.zz_bkp_cal_publications_20261021 from public, anon, authenticated;

-- O calendário do Cronograma é o mês inteiro (01 ao último dia): publicação com data depois do dia 27 fica no calendário do próprio mês.
-- O Dia D da agência continua valendo para o Magic Number, mas não separa mais os calendários do Cronograma.
create or replace function public.calendar_cycle_bounds(_ref date, _day integer)
returns table(cycle_start date, cycle_end date)
language sql
immutable
set search_path to 'public'
as $fn$
  select date_trunc('month', _ref)::date as cycle_start,
         (date_trunc('month', _ref) + interval '1 month - 1 day')::date as cycle_end;
$fn$;

create or replace function public.calendar_cycle_bounds(_ref date)
returns table(cycle_start date, cycle_end date)
language sql
immutable
set search_path to 'public'
as $fn$
  select * from public.calendar_cycle_bounds(_ref, 27);
$fn$;

-- os calendários 28→27 viram o mês do dia em que terminavam (28/09 a 27/10 vira 01/10 a 31/10)
update public.publication_calendars pc
set cycle_start = date_trunc('month', pc.cycle_end)::date,
    cycle_end = (date_trunc('month', pc.cycle_end) + interval '1 month - 1 day')::date
where extract(day from pc.cycle_start) <> 1;

-- cada publicação vai para o calendário do mês da data dela (o gatilho trg_calendar_publications_refile_by_date faz o trabalho)
update public.calendar_publications cp
set publish_date = cp.publish_date
from public.publication_calendars pc
where pc.id = cp.calendar_id and cp.deleted_at is null and cp.publish_date is not null
  and (cp.publish_date < pc.cycle_start or cp.publish_date > pc.cycle_end);
