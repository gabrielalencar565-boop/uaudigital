-- Follow-up mandado do celular para alguém que ainda não é lead: o WhatsApp só informa um código interno (LID), sem o número.
-- Guardamos esse código; quando a pessoa responde (agora com o número), a mensagem sai marcada como resposta a um contato nosso e o lead nasce sem disparar o gatilho "contato novo" (a boas-vindas).
create table if not exists public.whatsapp_zapi_outreach (
  agency_id uuid not null,
  lid text not null,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (agency_id, lid)
);
alter table public.whatsapp_zapi_outreach enable row level security;

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

select pg_temp.patch_fn('public.comercial_wa_inbound()',
$old$      perform set_config('comercial.wa_new', 'on', true);$old$,
$new$      perform set_config('comercial.wa_new', case when coalesce(new.raw ->> 'after_outreach', '') = 'true' then 'off' else 'on' end, true);$new$);
