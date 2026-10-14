-- A chave do WhatsApp (whatsapp_phone_key) trata qualquer "-" como grupo: só os dígitos do telefone entram nela.
create or replace function public.comercial_leads_before_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if new.phone is not null and regexp_replace(new.phone, '\D', '', 'g') <> '' then
    new.phone_key := public.whatsapp_phone_key(regexp_replace(new.phone, '\D', '', 'g'));
  else
    new.phone_key := null;
  end if;
  select type into v_type from public.comercial_stages where id = new.stage_id;
  if tg_op = 'UPDATE' and old.stage_id is distinct from new.stage_id then
    new.stage_changed_at := now();
  end if;
  if v_type = 'lost' and coalesce(btrim(new.loss_reason), '') = '' then
    raise exception 'Motivo de perda obrigatório quando a etapa é Perdido';
  end if;
  if v_type in ('won', 'lost') then
    if tg_op = 'INSERT' or old.stage_id is distinct from new.stage_id or new.closed_at is null then new.closed_at := now(); end if;
  else
    new.closed_at := null;
    new.loss_reason := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.comercial_leads_before_save() from public, anon, authenticated;
