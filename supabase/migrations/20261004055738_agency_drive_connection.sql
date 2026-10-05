-- Each agency connects its own Google Drive. The Drive refresh token lives in its own table (encrypted
-- with a Vault key, never readable through the API); the public-facing connection row only carries
-- non-secret status fields. Writes happen through the drive-connect edge function (service role).

create table public.agency_drive_connections (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  google_email text,
  root_folder_id text not null,
  root_folder_name text not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_error text,
  connected_by uuid references auth.users(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.agency_drive_connections enable row level security;
create policy "agency_drive_connections_admin_select" on public.agency_drive_connections
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role) and agency_id = (select public.current_agency_id()));
revoke all on table public.agency_drive_connections from anon, authenticated;
grant select on public.agency_drive_connections to authenticated;

create table public.agency_drive_secrets (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  refresh_token_enc bytea not null,
  updated_at timestamptz not null default now()
);
alter table public.agency_drive_secrets enable row level security;
revoke all on table public.agency_drive_secrets from anon, authenticated;

create table public.agency_drive_client_folders (
  client_id uuid primary key references public.clients(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  drive_folder_id text not null,
  created_at timestamptz not null default now()
);
create index agency_drive_client_folders_agency_idx on public.agency_drive_client_folders (agency_id);
alter table public.agency_drive_client_folders enable row level security;
create policy "agency_drive_client_folders_select" on public.agency_drive_client_folders
  for select to authenticated using (agency_id = (select public.current_agency_id()));
revoke all on table public.agency_drive_client_folders from anon, authenticated;
grant select on public.agency_drive_client_folders to authenticated;

-- Short-lived OAuth handshake rows (service role only: RLS on, no policies).
create table public.drive_oauth_states (
  state text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  created_at timestamptz not null default now()
);
alter table public.drive_oauth_states enable row level security;
revoke all on table public.drive_oauth_states from anon, authenticated;

-- Token encryption: separate Vault key, helpers callable only by the service role.
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'drive_tokens_key',
  'Encrypts agency_drive_secrets.refresh_token_enc'
) where not exists (select 1 from vault.secrets where name = 'drive_tokens_key');

create function public.save_drive_refresh_token(p_agency uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'drive_tokens_key';
  insert into public.agency_drive_secrets (agency_id, refresh_token_enc)
  values (p_agency, extensions.pgp_sym_encrypt(p_token, v_key))
  on conflict (agency_id) do update set refresh_token_enc = excluded.refresh_token_enc, updated_at = now();
end $$;

create function public.get_drive_refresh_token(p_agency uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_key text; v_token text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'drive_tokens_key';
  select extensions.pgp_sym_decrypt(refresh_token_enc, v_key) into v_token from public.agency_drive_secrets where agency_id = p_agency;
  return v_token;
end $$;

revoke all on function public.save_drive_refresh_token(uuid, text) from public, anon, authenticated;
revoke all on function public.get_drive_refresh_token(uuid) from public, anon, authenticated;
grant execute on function public.save_drive_refresh_token(uuid, text) to service_role;
grant execute on function public.get_drive_refresh_token(uuid) to service_role;
