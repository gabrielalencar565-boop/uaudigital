-- Storage policies trusted a GLOBAL admin role and, for pm-attachments, let any signed-in user list/read/write every file.
-- With open signup that means a trial user could enumerate and download another agency's client files.

-- Is this storage path owned by someone / something of the caller's agency?
--   pm-attachments layout: <uploader user id>/<...>  or  thumbnails/<task id>/<...>
create or replace function public.storage_pm_path_in_my_agency(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when (storage.foldername(p_name))[1] = 'thumbnails' then exists (
      select 1 from public.pm_tasks t
      where t.id::text = (storage.foldername(p_name))[2] and t.agency_id = (select public.current_agency_id()))
    else exists (
      select 1 from public.profiles p
      where p.user_id::text = (storage.foldername(p_name))[1] and p.agency_id = (select public.current_agency_id()))
  end
$$;
revoke all on function public.storage_pm_path_in_my_agency(text) from public, anon;
grant execute on function public.storage_pm_path_in_my_agency(text) to authenticated;

-- Was this object uploaded by someone of the caller's agency? (for buckets whose paths carry no agency/user prefix)
create or replace function public.storage_owner_in_my_agency(p_owner text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id::text = p_owner and p.agency_id is not null and p.agency_id = (select public.current_agency_id()))
$$;
revoke all on function public.storage_owner_in_my_agency(text) from public, anon;
grant execute on function public.storage_owner_in_my_agency(text) to authenticated;

-- pm-attachments
drop policy "pm_att_read" on storage.objects;
drop policy "pm_att_upload" on storage.objects;
drop policy "pm_att_delete" on storage.objects;
create policy "pm_att_read" on storage.objects for select to authenticated
  using (bucket_id = 'pm-attachments' and public.storage_pm_path_in_my_agency(name));
create policy "pm_att_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'pm-attachments'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or ((storage.foldername(name))[1] = 'thumbnails' and public.storage_pm_path_in_my_agency(name))));
create policy "pm_att_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pm-attachments'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or (public.has_role((select auth.uid()), 'admin'::public.app_role) and public.storage_pm_path_in_my_agency(name))));

-- avatars: own folder, or an admin of the SAME agency
drop policy "Users can upload their own avatar" on storage.objects;
drop policy "Users can update their own avatar" on storage.objects;
drop policy "Users can delete their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and ((select auth.uid())::text = (storage.foldername(name))[1]
    or (public.has_role((select auth.uid()), 'admin'::public.app_role) and public.storage_owner_in_my_agency((storage.foldername(name))[1]))));
create policy "Users can update their own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and ((select auth.uid())::text = (storage.foldername(name))[1]
    or (public.has_role((select auth.uid()), 'admin'::public.app_role) and public.storage_owner_in_my_agency((storage.foldername(name))[1]))))
  with check (bucket_id = 'avatars' and ((select auth.uid())::text = (storage.foldername(name))[1]
    or (public.has_role((select auth.uid()), 'admin'::public.app_role) and public.storage_owner_in_my_agency((storage.foldername(name))[1]))));
create policy "Users can delete their own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((select auth.uid())::text = (storage.foldername(name))[1]
    or (public.has_role((select auth.uid()), 'admin'::public.app_role) and public.storage_owner_in_my_agency((storage.foldername(name))[1]))));

-- app-assets (logos, favicons, login backgrounds): anyone reads; only an admin writes, and only over objects
-- uploaded by someone of their own agency (paths carry no agency prefix)
drop policy "Admins can upload app assets" on storage.objects;
drop policy "Admins can update app assets" on storage.objects;
drop policy "Admins can delete app assets" on storage.objects;
create policy "Admins can upload app assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'app-assets' and public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "Admins can update app assets" on storage.objects for update to authenticated
  using (bucket_id = 'app-assets' and public.has_role((select auth.uid()), 'admin'::public.app_role) and public.storage_owner_in_my_agency(owner_id))
  with check (bucket_id = 'app-assets' and public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "Admins can delete app assets" on storage.objects for delete to authenticated
  using (bucket_id = 'app-assets' and public.has_role((select auth.uid()), 'admin'::public.app_role) and public.storage_owner_in_my_agency(owner_id));

-- crm-proposals (private): admins of the uploader's agency only
drop policy "Admins manage crm-proposals" on storage.objects;
create policy "Admins manage crm-proposals" on storage.objects for all to authenticated
  using (bucket_id = 'crm-proposals' and public.has_role((select auth.uid()), 'admin'::public.app_role) and public.storage_owner_in_my_agency(owner_id))
  with check (bucket_id = 'crm-proposals' and public.has_role((select auth.uid()), 'admin'::public.app_role));

-- problem-report-attachments: own folder only (no global admin override)
drop policy "Users can upload own problem report attachments" on storage.objects;
drop policy "Users can delete own problem report attachments" on storage.objects;
create policy "Users can upload own problem report attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'problem-report-attachments' and (select auth.uid())::text = (storage.foldername(name))[1]);
create policy "Users can delete own problem report attachments" on storage.objects for delete to authenticated
  using (bucket_id = 'problem-report-attachments' and (select auth.uid())::text = (storage.foldername(name))[1]);
