-- O Cronograma passa a ser por MÊS DE CALENDÁRIO (1 a último dia), não mais 28→27: o dia 28 a 31 conta no próprio mês e não aparece "apagado".
-- Nada mais no banco depende do 28/27: tudo que cria ou acha o calendário de uma data passa por calendar_cycle_bounds.
create or replace function public.calendar_cycle_bounds(_ref date)
returns table(cycle_start date, cycle_end date)
language sql
immutable
set search_path to 'public'
as $fn$
  select date_trunc('month', _ref)::date as cycle_start,
         (date_trunc('month', _ref) + interval '1 month' - interval '1 day')::date as cycle_end;
$fn$;

-- Os calendários que já existem (28 a 27) viram o mês em que terminam: 28/09–27/10 vira outubro (01/10–31/10). Link de aprovação e status continuam os mesmos.
update public.publication_calendars
set cycle_start = date_trunc('month', cycle_end)::date,
    cycle_end = (date_trunc('month', cycle_end) + interval '1 month' - interval '1 day')::date
where extract(day from cycle_start) = 28;

-- Publicações que ficaram fora do mês do calendário (ex.: 28 a 30/09 que estavam no ciclo de outubro) vão para o calendário do mês delas
-- (o gatilho trg_calendar_publications_refile_by_date faz o trabalho).
update public.calendar_publications cp
set publish_date = cp.publish_date
from public.publication_calendars pc
where pc.id = cp.calendar_id and cp.deleted_at is null and cp.publish_date is not null
  and (cp.publish_date < pc.cycle_start or cp.publish_date > pc.cycle_end);
