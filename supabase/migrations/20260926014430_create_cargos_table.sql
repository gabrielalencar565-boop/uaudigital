-- Lista fechada de cargos, editável por admin (Configurações → Cargos) — substitui a
-- constante fixa ROLE_OPTIONS no código, que exigia publicar código pra mudar a lista.
create table public.cargos (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  order_index int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.cargos is
  'Lista fechada de cargos da equipe (Social Media, Designer, etc.), editável em Configurações → Cargos por admin. role_title em profiles/team_members deve bater com um cargos.label ativo.';

alter table public.cargos enable row level security;

create policy "cargos_select_authenticated"
  on public.cargos for select
  to authenticated
  using (true);

create policy "cargos_admin_write"
  on public.cargos for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

insert into public.cargos (key, label, order_index) values
  ('social_media', 'Social Media', 1),
  ('designer', 'Designer', 2),
  ('editor_de_video', 'Editor de Vídeo', 3),
  ('head_de_conteudo', 'Head de Conteúdo', 4),
  ('diretor_de_arte', 'Diretor de Arte', 5),
  ('diretor_de_video', 'Diretor de Vídeo', 6);
