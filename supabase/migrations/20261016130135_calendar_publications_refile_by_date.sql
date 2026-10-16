-- Publicação com data fora do ciclo do calendário em que está (ex.: 28/10 num calendário 28/09–27/10) aparecia no mês errado e entrava na contagem
-- dele. Quem trocava a data no painel da publicação não passava pelo "re-arquivar" do arrastar-e-soltar. Agora o banco faz isso sempre que a data muda:
-- a publicação vai para o calendário do ciclo que contém a data (o dia 28 em diante já é o ciclo seguinte).
create or replace function public.calendar_publications_refile_by_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_client uuid;
  v_agency uuid;
  v_start date;
  v_bounds record;
  v_calendar uuid;
begin
  if new.publish_date is null then return new; end if;
  select pc.client_id, pc.agency_id, pc.cycle_start into v_client, v_agency, v_start from public.publication_calendars pc where pc.id = new.calendar_id;
  if v_client is null then return new; end if;
  select * into v_bounds from public.calendar_cycle_bounds(new.publish_date);
  if v_start = v_bounds.cycle_start then return new; end if;
  insert into public.publication_calendars (client_id, cycle_start, cycle_end, agency_id)
  values (v_client, v_bounds.cycle_start, v_bounds.cycle_end, v_agency)
  on conflict (client_id, cycle_start) do update set client_id = excluded.client_id
  returning id into v_calendar;
  new.calendar_id := v_calendar;
  return new;
end;
$fn$;
revoke execute on function public.calendar_publications_refile_by_date() from public, anon, authenticated;

create trigger trg_calendar_publications_refile_by_date
before insert or update of publish_date on public.calendar_publications
for each row execute function public.calendar_publications_refile_by_date();

-- as que já estavam no calendário errado vão para o certo (o gatilho acima faz o trabalho)
update public.calendar_publications cp
set publish_date = cp.publish_date
from public.publication_calendars pc
where pc.id = cp.calendar_id and cp.deleted_at is null and cp.publish_date is not null
  and (cp.publish_date < pc.cycle_start or cp.publish_date > pc.cycle_end);
