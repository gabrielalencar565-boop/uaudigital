-- Mapa "id interno (LID) -> telefone" do WhatsApp. As mensagens enviadas pelo celular chegam ao webhook do Z-API só com o LID do contato (sem o número);
-- as recebidas trazem o número e o LID juntos, e é daí que o mapa é aprendido.
create table public.whatsapp_zapi_lids (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lid text not null,
  phone text not null,
  updated_at timestamptz not null default now(),
  primary key (agency_id, lid)
);
alter table public.whatsapp_zapi_lids enable row level security;
revoke all on public.whatsapp_zapi_lids from public, anon, authenticated;
