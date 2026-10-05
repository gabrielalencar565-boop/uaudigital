-- list_users_admin() is SECURITY DEFINER and returned every user of every agency (with e-mails) to any admin.
create or replace function public.list_users_admin()
returns table(user_id uuid, email text, display_name text, role_title text, role_titles text[], avatar_url text, is_active boolean,
              access_status access_request_status, requested_at timestamptz, decided_at timestamptz, decided_by uuid, access_request_id uuid)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'forbidden';
  end if;

  return query
  select
    au.id as user_id,
    au.email::text,
    coalesce(tm.display_name, p.full_name, split_part(au.email, '@', 1)) as display_name,
    coalesce(nullif(tm.role_title, ''), nullif(p.role_title, ''), 'Colaborador') as role_title,
    coalesce(tm.role_titles, p.role_titles, '{}'::text[]) as role_titles,
    coalesce(tm.avatar_url, p.avatar_url) as avatar_url,
    coalesce(tm.is_active, true) as is_active,
    ar.status as access_status,
    ar.requested_at,
    ar.decided_at,
    ar.decided_by,
    ar.id as access_request_id
  from auth.users au
  left join public.access_requests ar on ar.user_id = au.id
  left join public.team_members tm on tm.user_id = au.id
  left join public.profiles p on p.user_id = au.id
  where ar.id is not null
    -- only people of the caller's own agency; legacy requests that never got an agency are the platform owner's to triage
    and (ar.agency_id = public.current_agency_id() or (ar.agency_id is null and public.is_platform_admin()))
  order by
    case ar.status when 'pending' then 1 when 'approved' then 2 when 'rejected' then 3 end,
    ar.requested_at desc nulls last;
end;
$$;

-- Action-style SECURITY DEFINER functions were callable by anyone holding the (public) anon key. Only signed-in users
-- and the backend need them; RLS policy helpers (has_role, has_feature_permission, chat_*_participant/sender/type,
-- current_magic_number_day, same_agency, is_platform_admin) are left alone because policies evaluate them as anon too.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.proname in (
        'whatsapp_check_ranking_changes','whatsapp_dispatch_event','whatsapp_enqueue','whatsapp_enqueue_phone',
        'whatsapp_link_contact_to_user','ops_capture_snapshot','pm_recalc_tag_points','pm_resync_correction',
        'pm_sync_stage_completion','snapshot_unscored_tasks','magic2_seed_year','toggle_stage_tasks_checklist',
        'crm_should_send_welcome','list_users_admin','chat_ensure_general_member','chat_get_or_create_direct','chat_mark_read'
      )
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;
