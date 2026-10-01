create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agencies is 'Cada linha é um tenant (agência) isolado — base do modelo multi-tenant. "status" começa em trial (sem cobrança) por padrão.';
