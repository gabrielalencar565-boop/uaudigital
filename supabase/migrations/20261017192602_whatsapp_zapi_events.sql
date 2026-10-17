-- Diário curto das chamadas do webhook do Z-API (últimas 50), só para diagnóstico: o que chegou e por que foi (ou não) guardado.
create table public.whatsapp_zapi_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  agency_id uuid references public.agencies(id) on delete cascade,
  outcome text not null,
  summary jsonb
);
alter table public.whatsapp_zapi_events enable row level security;
revoke all on public.whatsapp_zapi_events from public, anon, authenticated;
