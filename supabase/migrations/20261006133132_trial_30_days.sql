-- The free trial is 30 days (matches the landing page), not 14. Only affects agencies created from now on.
create or replace function public.create_my_agency(p_agency_name text, p_full_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_agency_name, ''));
  v_full text := btrim(coalesce(p_full_name, ''));
  v_agency uuid;
  v_base text;
  v_slug text;
  v_n int := 1;
  v_src uuid;
  v_cargo text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select agency_id into v_agency from public.profiles where user_id = v_uid;
  if v_agency is not null then return v_agency; end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'invalid_agency_name'; end if;
  if char_length(v_full) < 2 or char_length(v_full) > 80 then raise exception 'invalid_name'; end if;

  v_base := trim(both '-' from regexp_replace(lower(extensions.unaccent(v_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'agencia'; end if;
  v_slug := v_base;
  while exists (select 1 from public.agencies where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.agencies (name, slug, status, trial_ends_at, owner_id, max_seats)
  values (v_name, v_slug, 'trial', now() + interval '30 days', v_uid, 5)
  returning id into v_agency;   -- the agencies trigger seeds the stage catalog and the default cascade

  -- first role title for the owner
  v_cargo := 'gestao-' || substr(md5(v_agency::text), 1, 8);
  insert into public.cargos (key, label, order_index, is_active, agency_id)
  values (v_cargo, 'Gestão', 0, true, v_agency);

  perform public.attach_user_to_agency(v_uid, v_agency, v_full, 'admin', array['Gestão']);

  insert into public.app_settings (id, agency_id, workspace_name)
  select coalesce((select max(id) from public.app_settings), 0) + 1, v_agency, v_name;

  -- start from the platform's default flow (structure only — no assignees)
  select f.agency_id into v_src
  from public.pm_stage_flows f join public.agencies a on a.id = f.agency_id
  where f.is_default and a.slug = 'uau-digital' limit 1;
  if v_src is not null then
    insert into public.pm_stage_flows (name, flow_config, transition_dates, stage_assignees, is_default, agency_id, created_by)
    select name, flow_config, transition_dates, '{}'::jsonb, true, v_agency, v_uid
    from public.pm_stage_flows where agency_id = v_src and is_default limit 1;
  end if;

  return v_agency;
end;
$$;
