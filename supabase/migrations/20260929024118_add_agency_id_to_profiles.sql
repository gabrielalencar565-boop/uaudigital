alter table public.profiles
  add column agency_id uuid references public.agencies(id);

comment on column public.profiles.agency_id is 'Agência (tenant) à qual esse usuário pertence. Preenchido no cadastro (nova agência ou convite pra uma existente).';
