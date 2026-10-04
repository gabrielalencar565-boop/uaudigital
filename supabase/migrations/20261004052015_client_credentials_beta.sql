-- Client logins (Instagram, Facebook, YouTube...). Passwords are encrypted at rest (pgcrypto, key in Supabase Vault);
-- the encrypted column is never readable through the API — only reveal_client_credential() decrypts, one row at a time,
-- and only for beta users of the same agency. Writes go through save_client_credential().
create table public.client_credentials (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.current_agency_id() references public.agencies(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform text not null check (platform in ('instagram','facebook','youtube','tiktok','linkedin','x','pinterest','google','whatsapp','email','site','canva','outro')),
  label text,
  username text,
  password_enc bytea,
  has_password boolean generated always as (password_enc is not null) stored,
  note text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_credentials_client_id_idx on public.client_credentials (client_id);
create index client_credentials_agency_id_idx on public.client_credentials (agency_id);
alter table public.client_credentials enable row level security;

create policy "client_credentials_beta_select" on public.client_credentials
  for select to authenticated
  using (public.has_beta_access('clientes') and agency_id = (select public.current_agency_id()));
create policy "client_credentials_beta_delete" on public.client_credentials
  for delete to authenticated
  using (public.has_beta_access('clientes') and agency_id = (select public.current_agency_id()));

revoke all on table public.client_credentials from anon, authenticated;
grant select (id, agency_id, client_id, platform, label, username, has_password, note, created_at, updated_at)
  on public.client_credentials to authenticated;
grant delete on public.client_credentials to authenticated;

select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'client_credentials_key',
  'Encrypts client_credentials.password_enc'
) where not exists (select 1 from vault.secrets where name = 'client_credentials_key');

create function public._client_credentials_key() returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'client_credentials_key'
$$;
revoke all on function public._client_credentials_key() from public, anon, authenticated;

create function public.save_client_credential(
  p_id uuid, p_client_id uuid, p_platform text, p_label text, p_username text, p_password text, p_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_agency uuid := public.current_agency_id();
  v_key text := public._client_credentials_key();
  v_id uuid;
begin
  if auth.uid() is null or not public.has_beta_access('clientes') then
    raise exception 'not allowed';
  end if;
  if not exists (select 1 from public.clients c where c.id = p_client_id and c.agency_id = v_agency) then
    raise exception 'client not found';
  end if;

  if p_id is null then
    insert into public.client_credentials (agency_id, client_id, platform, label, username, password_enc, note)
    values (
      v_agency, p_client_id, p_platform, nullif(btrim(p_label), ''), nullif(btrim(p_username), ''),
      case when coalesce(p_password, '') = '' then null else extensions.pgp_sym_encrypt(p_password, v_key) end,
      nullif(btrim(p_note), '')
    )
    returning id into v_id;
  else
    -- p_password null = keep the current password; empty string = clear it.
    update public.client_credentials set
      platform = p_platform,
      label = nullif(btrim(p_label), ''),
      username = nullif(btrim(p_username), ''),
      password_enc = case
        when p_password is null then password_enc
        when p_password = '' then null
        else extensions.pgp_sym_encrypt(p_password, v_key)
      end,
      note = nullif(btrim(p_note), ''),
      updated_at = now()
    where id = p_id and agency_id = v_agency and client_id = p_client_id
    returning id into v_id;
    if v_id is null then raise exception 'not found'; end if;
  end if;
  return v_id;
end $$;

create function public.reveal_client_credential(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pw text;
begin
  if auth.uid() is null or not public.has_beta_access('clientes') then
    raise exception 'not allowed';
  end if;
  select extensions.pgp_sym_decrypt(password_enc, public._client_credentials_key()) into v_pw
  from public.client_credentials
  where id = p_id and agency_id = public.current_agency_id();
  return v_pw;
end $$;

revoke all on function public.save_client_credential(uuid, uuid, text, text, text, text, text) from public, anon;
revoke all on function public.reveal_client_credential(uuid) from public, anon;
grant execute on function public.save_client_credential(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.reveal_client_credential(uuid) to authenticated;
