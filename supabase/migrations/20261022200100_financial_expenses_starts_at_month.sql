-- Despesa recorrente cadastrada com "vale a partir de": não aparece nos meses antes dele. As antigas (false) seguem aparecendo no ano todo, como sempre.
alter table public.financial_expenses add column if not exists starts_at_month boolean not null default false;
