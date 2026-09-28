create table public.feature_permissions (
  key text primary key,
  label text not null,
  area text not null,
  allowed_roles app_role[] not null default '{admin}'::app_role[],
  allowed_cargos text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table public.feature_permissions is
  'Quem, além de admin (sempre permitido), pode acessar cada aba/ação com permissão configurável. Editado em Configurações → Permissões, só por admin.';

alter table public.feature_permissions enable row level security;

-- Todo mundo autenticado precisa ler isso pra saber o que pode ou não fazer.
create policy "feature_permissions_select_authenticated"
  on public.feature_permissions for select
  to authenticated
  using (true);

create policy "feature_permissions_admin_write"
  on public.feature_permissions for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

create function public.feature_permissions_set_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger feature_permissions_audit
  before update on public.feature_permissions
  for each row execute function public.feature_permissions_set_audit();

-- Estado inicial replica exatamente o comportamento atual (hardcoded) de cada gate, para que
-- ligar esta tabela não mude o acesso de ninguém até um admin mexer na tela de Permissões.
insert into public.feature_permissions (key, label, area, allowed_roles, allowed_cargos) values
  ('tab_financeiro', 'Aba Financeiro (Receitas, Despesas, Lançamentos, Metas)', 'Abas', '{admin}', '{}'),
  ('tab_comercial', 'Aba Comercial', 'Abas', '{admin}', '{}'),
  ('action_instagram_connect', 'Conectar/desconectar contas do Instagram', 'Ações', '{admin}', '{"Social Media"}'),
  ('action_manage_faq', 'Gerenciar FAQ da Central de Ajuda', 'Ações', '{developer}', '{}'),
  ('action_manage_changelog', 'Gerenciar Novidades/Changelog da Central de Ajuda', 'Ações', '{developer}', '{}'),
  ('action_whatsapp_broadcast', 'Disparar mensagem de WhatsApp para todos', 'Automações', '{admin}', '{}'),
  ('action_whatsapp_send', 'Enviar mensagem manual de WhatsApp para um usuário', 'Automações', '{admin}', '{}'),
  ('action_generate_recovery_link', 'Gerar link de recuperação de senha para outro usuário', 'Ações', '{admin}', '{}');
