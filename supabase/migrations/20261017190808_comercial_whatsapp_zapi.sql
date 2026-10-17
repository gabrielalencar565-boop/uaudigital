-- Conexão não oficial (Z-API, por QR code) do WhatsApp do CRM, por agência. Fica ao lado da conexão da API oficial.
-- O token da instância e o Client-Token ficam só aqui (sem acesso do cliente); a tela lê o estado pelo RPC whatsapp_zapi_status().
create table public.whatsapp_zapi_connections (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  instance_id text not null,
  instance_token text not null,
  client_token text,
  webhook_key text not null unique,
  connected_phone text,
  last_error text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_zapi_connections enable row level security;
revoke all on public.whatsapp_zapi_connections from public, anon, authenticated;

create or replace function public.whatsapp_zapi_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    (select jsonb_build_object(
        'connected', true, 'instance_id', c.instance_id, 'webhook_key', c.webhook_key,
        'connected_phone', c.connected_phone, 'connected_at', c.connected_at, 'last_error', c.last_error)
     from public.whatsapp_zapi_connections c
     where c.agency_id = public.current_agency_id() and public.has_role((select auth.uid()), 'admin'::public.app_role)),
    jsonb_build_object('connected', false));
$fn$;
revoke execute on function public.whatsapp_zapi_status() from public, anon;
grant execute on function public.whatsapp_zapi_status() to authenticated;
