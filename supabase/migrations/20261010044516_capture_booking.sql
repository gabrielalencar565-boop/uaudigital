-- Public "captação" scheduling: one shared link per agency, a capacity per day, bookings that block days as they come in.

create table public.capture_settings (
  agency_id uuid primary key default public.current_agency_id() references public.agencies(id) on delete cascade,
  enabled boolean not null default false,
  share_token uuid not null default gen_random_uuid(),
  weekdays smallint[] not null default '{1,2,3,4,5}',
  capacity_per_day smallint not null default 2 check (capacity_per_day between 1 and 20),
  min_lead_days smallint not null default 2 check (min_lead_days between 0 and 60),
  open_months text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create unique index capture_settings_share_token_idx on public.capture_settings (share_token);

create table public.capture_blocks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  block_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (agency_id, block_date)
);

create table public.capture_bookings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  booking_date date not null,
  period text not null check (period in ('manha', 'tarde')),
  company_name text not null check (char_length(company_name) between 1 and 120),
  contact_name text check (contact_name is null or char_length(contact_name) <= 120),
  whatsapp text not null check (char_length(whatsapp) between 8 and 20),
  location text check (location is null or char_length(location) <= 300),
  notes text check (notes is null or char_length(notes) <= 1000),
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'refused', 'cancelled')),
  task_id uuid references public.tasks(id) on delete set null,
  cancel_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
create index capture_bookings_agency_date_idx on public.capture_bookings (agency_id, booking_date);
create unique index capture_bookings_cancel_token_idx on public.capture_bookings (cancel_token);

-- The two hard rules live in the database so two people clicking at the same time can't both get the last spot:
-- a blocked day takes no booking, and a day never holds more active bookings than its capacity.
create or replace function public.capture_booking_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_taken int;
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('pending', 'confirmed') and old.booking_date = new.booking_date then
    return new; -- nothing that affects the day's load changed
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.agency_id::text || new.booking_date::text, 0));

  if exists (select 1 from public.capture_blocks b where b.agency_id = new.agency_id and b.block_date = new.booking_date) then
    raise exception 'day_blocked' using errcode = 'P0001';
  end if;

  select coalesce(s.capacity_per_day, 2) into v_capacity from public.capture_settings s where s.agency_id = new.agency_id;
  v_capacity := coalesce(v_capacity, 2);

  select count(*) into v_taken
  from public.capture_bookings b
  where b.agency_id = new.agency_id
    and b.booking_date = new.booking_date
    and b.status in ('pending', 'confirmed')
    and b.id <> new.id;

  if v_taken >= v_capacity then
    raise exception 'day_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger capture_booking_guard_trg
before insert or update of status, booking_date on public.capture_bookings
for each row execute function public.capture_booking_guard();

alter table public.capture_settings enable row level security;
alter table public.capture_blocks enable row level security;
alter table public.capture_bookings enable row level security;

-- The team of the agency reads everything; only admins change the rules. The public page never touches these tables
-- directly: it goes through the public-agendamento edge function (service role), which only returns free/full/blocked.
create policy capture_settings_read on public.capture_settings for select to authenticated
  using (agency_id = public.current_agency_id());
create policy capture_settings_admin_write on public.capture_settings for all to authenticated
  using (agency_id = public.current_agency_id() and public.has_role(auth.uid(), 'admin'))
  with check (agency_id = public.current_agency_id() and public.has_role(auth.uid(), 'admin'));

create policy capture_blocks_read on public.capture_blocks for select to authenticated
  using (agency_id = public.current_agency_id());
create policy capture_blocks_admin_write on public.capture_blocks for all to authenticated
  using (agency_id = public.current_agency_id() and public.has_role(auth.uid(), 'admin'))
  with check (agency_id = public.current_agency_id() and public.has_role(auth.uid(), 'admin'));

create policy capture_bookings_team on public.capture_bookings for all to authenticated
  using (agency_id = public.current_agency_id())
  with check (agency_id = public.current_agency_id());
