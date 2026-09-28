DROP FUNCTION public.list_users_admin();

CREATE FUNCTION public.list_users_admin()
 RETURNS TABLE(user_id uuid, email text, display_name text, role_title text, role_titles text[], avatar_url text, is_active boolean, access_status access_request_status, requested_at timestamp with time zone, decided_at timestamp with time zone, decided_by uuid, access_request_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    au.id as user_id,
    au.email::text,
    COALESCE(tm.display_name, p.full_name, split_part(au.email, '@', 1)) as display_name,
    COALESCE(NULLIF(tm.role_title, ''), NULLIF(p.role_title, ''), 'Colaborador') as role_title,
    COALESCE(tm.role_titles, p.role_titles, '{}'::text[]) as role_titles,
    COALESCE(tm.avatar_url, p.avatar_url) as avatar_url,
    COALESCE(tm.is_active, true) as is_active,
    ar.status as access_status,
    ar.requested_at,
    ar.decided_at,
    ar.decided_by,
    ar.id as access_request_id
  FROM auth.users au
  LEFT JOIN public.access_requests ar ON ar.user_id = au.id
  LEFT JOIN public.team_members tm ON tm.user_id = au.id
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE ar.id IS NOT NULL  -- Apenas quem solicitou acesso
  ORDER BY
    CASE ar.status
      WHEN 'pending' THEN 1
      WHEN 'approved' THEN 2
      WHEN 'rejected' THEN 3
    END,
    ar.requested_at DESC NULLS LAST;
END;
$function$;
