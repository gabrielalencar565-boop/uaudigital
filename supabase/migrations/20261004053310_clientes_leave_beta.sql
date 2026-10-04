-- Clientes (Cronograma + Resultados + Documentos + Configurações) leaves beta: access is now by agency,
-- except client logins, which follow the editable permission "action_client_credentials".

insert into public.feature_permissions (key, label, area, allowed_roles, allowed_cargos) values
  ('action_client_credentials', 'Ver e gerenciar logins e senhas dos clientes', 'Ações', '{admin}', '{"Social Media"}')
on conflict (key) do nothing;

-- Documents + their files
drop policy "client_documents_beta_all" on public.client_documents;
create policy "client_documents_agency_all" on public.client_documents
  for all to authenticated
  using (agency_id = (select public.current_agency_id()))
  with check (agency_id = (select public.current_agency_id()));

drop policy "client_documents_storage_all" on storage.objects;
create policy "client_documents_storage_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'client-documents' and (storage.foldername(name))[1] = (select public.current_agency_id())::text)
  with check (bucket_id = 'client-documents' and (storage.foldername(name))[1] = (select public.current_agency_id())::text);

-- Logins: permission-gated instead of beta-gated
drop policy "client_credentials_beta_select" on public.client_credentials;
drop policy "client_credentials_beta_delete" on public.client_credentials;
create policy "client_credentials_permission_select" on public.client_credentials
  for select to authenticated
  using (public.has_feature_permission((select auth.uid()), 'action_client_credentials') and agency_id = (select public.current_agency_id()));
create policy "client_credentials_permission_delete" on public.client_credentials
  for delete to authenticated
  using (public.has_feature_permission((select auth.uid()), 'action_client_credentials') and agency_id = (select public.current_agency_id()));

create or replace function public.save_client_credential(
  p_id uuid, p_client_id uuid, p_platform text, p_label text, p_username text, p_password text, p_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_agency uuid := public.current_agency_id();
  v_key text := public._client_credentials_key();
  v_id uuid;
begin
  if auth.uid() is null or not public.has_feature_permission(auth.uid(), 'action_client_credentials') then
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

create or replace function public.reveal_client_credential(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_pw text;
begin
  if auth.uid() is null or not public.has_feature_permission(auth.uid(), 'action_client_credentials') then
    raise exception 'not allowed';
  end if;
  select extensions.pgp_sym_decrypt(password_enc, public._client_credentials_key()) into v_pw
  from public.client_credentials
  where id = p_id and agency_id = public.current_agency_id();
  return v_pw;
end $$;

-- Instagram metrics: agency-scoped instead of beta-scoped (writes still happen only through the edge function)
drop policy "instagram_audience_snapshots_select_beta" on public.instagram_audience_snapshots;
create policy "instagram_audience_snapshots_select_agency" on public.instagram_audience_snapshots
  for select to authenticated using (agency_id = (select public.current_agency_id()));

drop policy "instagram_media_insights_select_beta" on public.instagram_media_insights;
create policy "instagram_media_insights_select_agency" on public.instagram_media_insights
  for select to authenticated using (agency_id = (select public.current_agency_id()));

drop policy "instagram_metric_snapshots_select_beta" on public.instagram_metric_snapshots;
create policy "instagram_metric_snapshots_select_agency" on public.instagram_metric_snapshots
  for select to authenticated using (agency_id = (select public.current_agency_id()));

drop policy "instagram_report_links_beta_all" on public.instagram_report_links;
create policy "instagram_report_links_agency_all" on public.instagram_report_links
  for all to authenticated
  using (agency_id = (select public.current_agency_id()))
  with check (agency_id = (select public.current_agency_id()));
