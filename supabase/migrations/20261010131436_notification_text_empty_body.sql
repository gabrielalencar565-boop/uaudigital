-- A notification may have no text on purpose (title only = the most compact one on iOS).
-- null = the default text; an empty string = really no text.
create or replace function public.notification_text(p_agency uuid, p_key text, p_vars jsonb)
returns table (title text, body text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d record;
  s record;
  kv record;
  t text;
  b text;
begin
  select * into d from public.notification_default(p_key);
  select st.title as ct, st.body as cb into s from public.notification_settings st where st.agency_id = p_agency and st.key = p_key;
  t := coalesce(nullif(btrim(s.ct), ''), d.title);
  b := case when s.cb is null then d.body else btrim(s.cb) end;
  for kv in select e.key as k, e.value as v from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) e loop
    t := replace(t, '{' || kv.k || '}', left(coalesce(kv.v, ''), 40));
    b := replace(b, '{' || kv.k || '}', left(coalesce(kv.v, ''), 40));
  end loop;
  return query select t, b;
end;
$$;

revoke execute on function public.notification_text(uuid, text, jsonb) from public, anon, authenticated;
