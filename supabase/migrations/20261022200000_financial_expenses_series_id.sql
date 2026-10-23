-- Despesa recorrente com reajuste: cada versão é uma linha ancorada no mês em que passou a valer; series_id liga as versões da mesma despesa (a primeira linha usa o próprio id).
alter table public.financial_expenses add column if not exists series_id uuid;
