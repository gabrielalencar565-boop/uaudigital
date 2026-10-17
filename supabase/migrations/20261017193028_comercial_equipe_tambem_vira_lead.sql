-- Quem manda mensagem para o número do CRM é lead, mesmo que o número seja de alguém da equipe:
-- (1) o contato não é mais marcado como "colaborador" (o que o escondia de Conversas) e (2) a mensagem volta a criar o lead.
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
$old$  if exists (select 1 from public.user_whatsapp_preferences p where p.phone_e164 is not null and public.whatsapp_phone_key(p.phone_e164) = new.contact_phone_key) then
    return new;
  end if;
$old$, '');

select pg_temp.patch_fn('public.whatsapp_messages_update_contact()',
$old$CASE WHEN v_user IS NOT NULL THEN 'colaborador' ELSE 'lead' END$old$, $new$'lead'$new$);

-- o contato que já tinha sido marcado como colaborador volta a ser lead
update public.whatsapp_contacts set origin = 'lead' where origin = 'colaborador';
