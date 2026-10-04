-- Links/documents the team keeps per client (briefing, contract, brand book, logins, Drive folder...).
-- Beta: same per-user gate as the Clientes tab.
create table public.client_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  url text not null check (url ~* '^https?://'),
  kind text not null default 'outro' check (kind in ('briefing', 'contrato', 'marca', 'acessos', 'drive', 'outro')),
  note text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index client_documents_client_id_idx on public.client_documents (client_id);
create index client_documents_agency_id_idx on public.client_documents (agency_id);
alter table public.client_documents enable row level security;
create policy "client_documents_beta_all" on public.client_documents
  for all to authenticated
  using (public.has_beta_access('clientes') and agency_id = (select public.current_agency_id()))
  with check (public.has_beta_access('clientes') and agency_id = (select public.current_agency_id()));
