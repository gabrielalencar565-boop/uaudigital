-- Dia D por ciclo: além do dia padrão da agência (Configurações → Agência → Dia D), um mês pode ter o seu próprio Dia D
-- (ex.: dezembro fecha dia 18 por causa das festas). O ciclo de um mês termina no Dia D dele e começa no dia seguinte ao Dia D
-- do mês anterior. Mês sem exceção continua usando o dia padrão, então nada muda enquanto não houver exceção cadastrada.

create table public.dia_d_overrides (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  day integer not null check (day between 1 and 28),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, year, month)
);
alter table public.dia_d_overrides enable row level security;
-- leitura para quem é da agência; a escrita só passa por set_dia_d_override (administrador)
create policy dia_d_overrides_select on public.dia_d_overrides for select to authenticated
  using (agency_id = (select public.current_agency_id()));

-- Dia D de um mês: a exceção, se houver, senão o dia padrão da agência
create or replace function public.dia_d_for(p_agency uuid, p_year integer, p_month integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    (select o.day from public.dia_d_overrides o where o.agency_id = p_agency and o.year = p_year and o.month = p_month),
    public.agency_cycle_day(p_agency)
  );
$fn$;
revoke execute on function public.dia_d_for(uuid, integer, integer) from public, anon;
grant execute on function public.dia_d_for(uuid, integer, integer) to authenticated, service_role;

-- mesma coisa para a agência de quem está logado (usada nas políticas de segurança)
create or replace function public.current_dia_d(p_year integer, p_month integer)
returns integer
language sql
stable
security definer
set search_path = 'public'
as $fn$
  select public.dia_d_for(public.current_agency_id(), p_year, p_month);
$fn$;
revoke execute on function public.current_dia_d(integer, integer) from public, anon;
grant execute on function public.current_dia_d(integer, integer) to authenticated, service_role;

-- Limites do ciclo que contém uma data, respeitando as exceções: termina no Dia D do mês do ciclo e começa um dia depois do Dia D do mês anterior
create or replace function public.calendar_cycle_bounds_agency(_ref date, p_agency uuid)
returns table(cycle_start date, cycle_end date)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_d integer;
  v_cm date;
  v_pm date;
begin
  v_d := public.dia_d_for(p_agency, extract(year from _ref)::integer, extract(month from _ref)::integer);
  v_cm := date_trunc('month', _ref)::date;
  if extract(day from _ref) > v_d then v_cm := (v_cm + interval '1 month')::date; end if;
  v_pm := (v_cm - interval '1 month')::date;
  cycle_end := v_cm + (public.dia_d_for(p_agency, extract(year from v_cm)::integer, extract(month from v_cm)::integer) - 1);
  cycle_start := v_pm + public.dia_d_for(p_agency, extract(year from v_pm)::integer, extract(month from v_pm)::integer);
  return next;
end;
$fn$;
revoke execute on function public.calendar_cycle_bounds_agency(date, uuid) from public, anon, authenticated;
grant execute on function public.calendar_cycle_bounds_agency(date, uuid) to service_role;

-- Define (ou remove, com p_day nulo) a exceção de um mês. Acerta junto o que já foi criado para o mês:
-- datas dos ciclos do Magic Number e os calendários que estavam no período padrão (os ajustados à mão ficam como estão).
create or replace function public.set_dia_d_override(p_year integer, p_month integer, p_day integer, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_agency uuid := public.current_agency_id();
  v_base integer;
  v_old integer;
  v_new integer;
  v_old_end date;
  v_new_end date;
  c record;
  v_moved integer := 0;
  v_failed integer := 0;
begin
  if auth.uid() is null or v_agency is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Unauthorized';
  end if;
  if p_year is null or p_month is null or p_year < 2000 or p_year > 2100 or p_month < 1 or p_month > 12 then
    raise exception 'Mês inválido';
  end if;
  if p_day is not null and (p_day < 1 or p_day > 28) then
    raise exception 'O dia deve ser um número entre 1 e 28';
  end if;

  v_base := public.agency_cycle_day(v_agency);
  v_old := public.dia_d_for(v_agency, p_year, p_month);

  if p_day is null or p_day = v_base then
    delete from public.dia_d_overrides where agency_id = v_agency and year = p_year and month = p_month;
    v_new := v_base;
  else
    insert into public.dia_d_overrides (agency_id, year, month, day, reason)
    values (v_agency, p_year, p_month, p_day, nullif(btrim(coalesce(p_reason, '')), ''))
    on conflict (agency_id, year, month) do update set day = excluded.day, reason = excluded.reason, updated_at = now();
    v_new := p_day;
  end if;

  if v_new = v_old then
    return jsonb_build_object('day', v_new, 'moved', 0, 'failed', 0);
  end if;

  -- data de cada ciclo do Magic Number daquele mês
  update public.magic2_cycles set due_date = make_date(p_year, p_month, v_new)
  where agency_id = v_agency and year = p_year and month = p_month and due_date is distinct from make_date(p_year, p_month, v_new);
  update public.client_cycles set due_date = make_date(p_year, p_month, v_new)
  where agency_id = v_agency and year = p_year and month = p_month and due_date is distinct from make_date(p_year, p_month, v_new);

  -- calendários no período padrão: o fim do mês vai para o novo Dia D e o seguinte começa um dia depois
  v_old_end := make_date(p_year, p_month, v_old);
  v_new_end := make_date(p_year, p_month, v_new);
  for c in select pc.id, pc.cycle_start from public.publication_calendars pc where pc.agency_id = v_agency and pc.cycle_end = v_old_end loop
    begin
      if v_new_end >= c.cycle_start then
        perform public.set_calendar_period(c.id, c.cycle_start, v_new_end);
        v_moved := v_moved + 1;
      else
        v_failed := v_failed + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;
  -- cliente cujo calendário do mês ainda não existe mas o seguinte já existe: o seguinte passa a começar depois do novo Dia D
  for c in
    select pc.id, pc.cycle_end from public.publication_calendars pc
    where pc.agency_id = v_agency and pc.cycle_start = v_old_end + 1
      and not exists (select 1 from public.publication_calendars x where x.client_id = pc.client_id and x.cycle_end = v_new_end)
  loop
    begin
      if v_new_end + 1 <= c.cycle_end then
        perform public.set_calendar_period(c.id, v_new_end + 1, c.cycle_end);
        v_moved := v_moved + 1;
      else
        v_failed := v_failed + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object('day', v_new, 'moved', v_moved, 'failed', v_failed);
end;
$fn$;
revoke execute on function public.set_dia_d_override(integer, integer, integer, text) from public, anon;
grant execute on function public.set_dia_d_override(integer, integer, integer, text) to authenticated, service_role;

-- As funções que criam calendários e ciclos passam a usar o Dia D do mês
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

select pg_temp.patch_fn('public.calendar_for_date(uuid,uuid,date)', 'public.calendar_cycle_bounds(p_date, public.agency_cycle_day(p_agency))', 'public.calendar_cycle_bounds_agency(p_date, p_agency)');
select pg_temp.patch_fn('public.reset_calendar_period(uuid)', 'public.calendar_cycle_bounds(c.cycle_start + ((c.cycle_end - c.cycle_start) / 2), public.agency_cycle_day(c.agency_id))', 'public.calendar_cycle_bounds_agency(c.cycle_start + ((c.cycle_end - c.cycle_start) / 2), c.agency_id)');
select pg_temp.patch_fn('public.magic2_sync_from_task()', 'make_date(v_year, v_month, public.current_magic_number_day())', 'make_date(v_year, v_month, public.dia_d_for(NEW.agency_id, v_year, v_month))');
select pg_temp.patch_fn('public.magic2_seed_year(integer)', 'make_date(_year, m, v_day)', 'make_date(_year, m, public.dia_d_for(v_agency, _year, m))');

-- As políticas que exigiam due_date = Dia D único passam a exigir o Dia D do mês do ciclo
do $do$
declare
  r record;
  v_old constant text := '( SELECT current_magic_number_day() AS current_magic_number_day)';
  v_pre text;
  v_new text;
  v_q text;
  v_wc text;
begin
  for r in
    select tablename, policyname, cmd, qual, with_check from pg_policies
    where schemaname = 'public' and (coalesce(qual, '') like '%current_magic_number_day%' or coalesce(with_check, '') like '%current_magic_number_day%')
  loop
    v_pre := case r.tablename when 'client_cycle_stages' then 'cc.' when 'magic2_cycle_stages' then 'c.' else '' end;
    v_new := format('( SELECT current_dia_d(%1$syear, %1$smonth) AS current_dia_d)', v_pre);
    v_q := replace(r.qual, v_old, v_new);
    v_wc := replace(r.with_check, v_old, v_new);
    if v_q like '%current_magic_number_day%' or v_wc like '%current_magic_number_day%' then
      raise exception 'política % em %: trecho não substituído', r.policyname, r.tablename;
    end if;
    if r.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, v_wc);
    elsif r.cmd = 'UPDATE' then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', r.policyname, r.tablename, v_q, v_wc);
    else
      raise exception 'política % em %: comando % não previsto', r.policyname, r.tablename, r.cmd;
    end if;
  end loop;
end;
$do$;
