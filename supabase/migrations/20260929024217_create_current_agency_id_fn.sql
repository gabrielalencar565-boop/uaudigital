create or replace function public.current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.profiles where user_id = auth.uid()
$$;

comment on function public.current_agency_id() is 'Agência do usuário autenticado — usada em toda política de RLS pra isolar dado entre agências (tenants). security definer pra poder ler profiles mesmo sob a RLS da própria tabela.';

revoke all on function public.current_agency_id() from public;
grant execute on function public.current_agency_id() to authenticated;
