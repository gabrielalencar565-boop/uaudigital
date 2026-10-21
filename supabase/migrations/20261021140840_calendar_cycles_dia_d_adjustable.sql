-- O ciclo do Cronograma volta a seguir o Dia D (28→27 com Dia D = 27) e passa a poder ser ajustado calendário a calendário:
-- é possível puxar o início de novembro para 21/10, por exemplo, e a última semana de outubro vai junto com novembro (inclusive no link do cliente).

-- 1) limites do ciclo pelo Dia D (como antes da conversão para mês inteiro)
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

-- 2) calendário de um cliente para uma data: o que já contém a data (mesmo com período ajustado) ou, se não houver, o do ciclo padrão
--    aparado pelos calendários vizinhos já ajustados à mão
create or replace function public.calendar_for_date(p_client uuid, p_agency uuid, p_date date)
returns uuid
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_id uuid;
  v_std record;
  v_start date;
  v_end date;
  v_prev date;
  v_next date;
begin
  select pc.id into v_id from public.publication_calendars pc
  where pc.client_id = p_client and pc.cycle_start <= p_date and pc.cycle_end >= p_date
  order by pc.cycle_start desc limit 1;
  if v_id is not null then return v_id; end if;

  select * into v_std from public.calendar_cycle_bounds(p_date, public.agency_cycle_day(p_agency));
  v_start := v_std.cycle_start;
  v_end := v_std.cycle_end;

  select max(pc.cycle_end) into v_prev from public.publication_calendars pc where pc.client_id = p_client and pc.cycle_end < p_date;
  if v_prev is not null and v_prev >= v_start then v_start := v_prev + 1; end if;
  select min(pc.cycle_start) into v_next from public.publication_calendars pc where pc.client_id = p_client and pc.cycle_start > p_date;
  if v_next is not null and v_next <= v_end then v_end := v_next - 1; end if;

  insert into public.publication_calendars (client_id, cycle_start, cycle_end, agency_id)
  values (p_client, v_start, v_end, p_agency)
  on conflict (client_id, cycle_start) do update set client_id = excluded.client_id
  returning id into v_id;
  return v_id;
end;
$fn$;
revoke execute on function public.calendar_for_date(uuid, uuid, date) from public, anon, authenticated;

-- 3) quem cria/encaixa calendários passa a usar essa função
create or replace function public.ensure_publication_calendar(p_client_id uuid, p_date date)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_agency uuid;
begin
  select c.agency_id into v_agency from public.clients c where c.id = p_client_id;
  if v_agency is null or not public._caller_in_agency(v_agency) then
    raise exception 'forbidden';
  end if;
  return public.calendar_for_date(p_client_id, v_agency, p_date);
end;
$fn$;

create or replace function public.calendar_publications_refile_by_date()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_client uuid;
  v_agency uuid;
  v_start date;
  v_end date;
begin
  if new.publish_date is null then return new; end if;
  select pc.client_id, pc.agency_id, pc.cycle_start, pc.cycle_end into v_client, v_agency, v_start, v_end from public.publication_calendars pc where pc.id = new.calendar_id;
  if v_client is null then return new; end if;
  if new.publish_date between v_start and v_end then return new; end if;
  new.calendar_id := public.calendar_for_date(v_client, v_agency, new.publish_date);
  return new;
end;
$fn$;

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
$old$  SELECT * INTO v_bounds FROM public.calendar_cycle_bounds(COALESCE(NEW.posting_date, CURRENT_DATE), public.agency_cycle_day(NEW.agency_id));

  INSERT INTO public.publication_calendars (client_id, cycle_start, cycle_end)
  VALUES (NEW.client_id, v_bounds.cycle_start, v_bounds.cycle_end)
  ON CONFLICT (client_id, cycle_start) DO UPDATE SET client_id = EXCLUDED.client_id
  RETURNING id INTO v_calendar_id;
$old$,
$new$  v_calendar_id := public.calendar_for_date(NEW.client_id, NEW.agency_id, COALESCE(NEW.posting_date, CURRENT_DATE));
$new$);

-- 4) ajustar o período de um calendário (os vizinhos acompanham) e voltar ao padrão
create or replace function public.set_calendar_period(p_calendar uuid, p_start date, p_end date)
returns void
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  c record;
  v_prev uuid;
  v_prev_end date;
  v_next uuid;
  v_next_start date;
begin
  select * into c from public.publication_calendars where id = p_calendar;
  if not found or not public._caller_in_agency(c.agency_id) then raise exception 'forbidden'; end if;
  if p_start is null or p_end is null or p_start > p_end then raise exception 'periodo_invalido'; end if;
  if p_end - p_start > 62 then raise exception 'periodo_longo_demais'; end if;
  if exists (
    select 1 from public.publication_calendars x
    where x.client_id = c.client_id and x.id <> c.id and x.cycle_start >= p_start and x.cycle_end <= p_end
  ) then raise exception 'periodo_cobre_outro_calendario'; end if;

  -- o calendário anterior termina um dia antes do novo início (encurta se invade, estende se sobrou espaço)
  select x.id, x.cycle_end into v_prev, v_prev_end from public.publication_calendars x
  where x.client_id = c.client_id and x.id <> c.id and x.cycle_start < p_start order by x.cycle_start desc limit 1;
  if v_prev is not null and (v_prev_end >= p_start or p_start - v_prev_end <= 40) then
    update public.publication_calendars set cycle_end = p_start - 1 where id = v_prev;
  end if;
  -- e o seguinte começa um dia depois do novo fim
  select x.id, x.cycle_start into v_next, v_next_start from public.publication_calendars x
  where x.client_id = c.client_id and x.id <> c.id and x.cycle_start > c.cycle_start and x.cycle_start > p_start order by x.cycle_start asc limit 1;
  if v_next is not null and (v_next_start <= p_end or v_next_start - p_end <= 40) then
    update public.publication_calendars set cycle_start = p_end + 1 where id = v_next;
  end if;

  update public.publication_calendars set cycle_start = p_start, cycle_end = p_end where id = c.id;

  -- cada publicação datada vai para o calendário que agora contém a data dela
  update public.calendar_publications cp
  set calendar_id = public.calendar_for_date(c.client_id, c.agency_id, cp.publish_date)
  where cp.deleted_at is null and cp.publish_date is not null
    and cp.calendar_id in (select pc.id from public.publication_calendars pc where pc.client_id = c.client_id)
    and not exists (select 1 from public.publication_calendars x where x.id = cp.calendar_id and cp.publish_date between x.cycle_start and x.cycle_end);
end;
$fn$;
revoke execute on function public.set_calendar_period(uuid, date, date) from public, anon;
grant execute on function public.set_calendar_period(uuid, date, date) to authenticated;

create or replace function public.reset_calendar_period(p_calendar uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  c record;
  v_std record;
begin
  select * into c from public.publication_calendars where id = p_calendar;
  if not found or not public._caller_in_agency(c.agency_id) then raise exception 'forbidden'; end if;
  select * into v_std from public.calendar_cycle_bounds(c.cycle_start + ((c.cycle_end - c.cycle_start) / 2), public.agency_cycle_day(c.agency_id));
  perform public.set_calendar_period(p_calendar, v_std.cycle_start, v_std.cycle_end);
end;
$fn$;
revoke execute on function public.reset_calendar_period(uuid) from public, anon;
grant execute on function public.reset_calendar_period(uuid) to authenticated;

-- 5) os calendários de mês inteiro voltam a ser o ciclo do Dia D (outubro = 28/09 a 27/10)
update public.publication_calendars pc
set cycle_start = (date_trunc('month', pc.cycle_start) - interval '1 month')::date + public.agency_cycle_day(pc.agency_id),
    cycle_end = date_trunc('month', pc.cycle_start)::date + (public.agency_cycle_day(pc.agency_id) - 1)
where extract(day from pc.cycle_start) = 1;

-- 6) cada publicação vai para o calendário que contém a data dela (o gatilho trg_calendar_publications_refile_by_date faz o trabalho)
update public.calendar_publications cp
set publish_date = cp.publish_date
from public.publication_calendars pc
where pc.id = cp.calendar_id and cp.deleted_at is null and cp.publish_date is not null
  and (cp.publish_date < pc.cycle_start or cp.publish_date > pc.cycle_end);
