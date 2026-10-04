-- A document is now either a link (url) or an uploaded file (storage_path in the private bucket).
alter table public.client_documents
  alter column url drop not null,
  add column storage_path text,
  add column file_name text,
  add column file_size bigint,
  add constraint client_documents_url_or_file check (url is not null or storage_path is not null);

insert into storage.buckets (id, name, public, file_size_limit)
values ('client-documents', 'client-documents', false, 52428800)
on conflict (id) do nothing;

-- Objects live under {agency_id}/{client_id}/..., same per-user beta gate as the table.
create policy "client_documents_storage_all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'client-documents'
    and public.has_beta_access('clientes')
    and (storage.foldername(name))[1] = (select public.current_agency_id())::text
  )
  with check (
    bucket_id = 'client-documents'
    and public.has_beta_access('clientes')
    and (storage.foldername(name))[1] = (select public.current_agency_id())::text
  );
