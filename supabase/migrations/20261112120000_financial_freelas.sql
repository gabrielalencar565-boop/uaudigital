-- Freelas lançados em Receitas do Financeiro: valor total, parte do operacional (a da Uau é total - operacional, calculada na tela).
create table if not exists public.financial_freelas (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id) on delete cascade,
  contratante text not null,
  servico text not null,
  total numeric(12,2) not null check (total >= 0),
  operacional_valor numeric(12,2) not null default 0,
  operacional_user_id uuid references auth.users(id) on delete set null,
  operacional_nome text,
  date date not null default current_date,
  year integer generated always as (extract(year from date)::integer) stored,
  month integer generated always as (extract(month from date)::integer) stored,
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  paid_at date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_freelas_operacional_ok check (operacional_valor >= 0 and operacional_valor <= total)
);

create index if not exists financial_freelas_agency_ym_idx on public.financial_freelas (agency_id, year, month);

alter table public.financial_freelas enable row level security;
drop policy if exists fin_freelas_admin_all on public.financial_freelas;
create policy fin_freelas_admin_all on public.financial_freelas for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role) and agency_id = (select public.current_agency_id()))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role) and agency_id = (select public.current_agency_id()));

create trigger update_financial_freelas_updated_at before update on public.financial_freelas
  for each row execute function public.update_updated_at_column();
