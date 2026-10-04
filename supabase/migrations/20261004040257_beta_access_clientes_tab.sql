-- New "Clientes" tab (Cronograma + Resultados per client), beta: only users listed here see it.
insert into public.beta_feature_access (feature, user_id)
values ('clientes', 'e674c34f-b268-4dfd-82c5-9aea9cba853e')
on conflict do nothing;
