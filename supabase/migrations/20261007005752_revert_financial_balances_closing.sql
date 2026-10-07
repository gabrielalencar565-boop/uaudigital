-- Desfaz as duas migrações anteriores (saldo final por mês): volta ao estado original da tabela.
alter table public.financial_opening_balances alter column amount set default 0;
update public.financial_opening_balances set amount = 0 where amount is null;
alter table public.financial_opening_balances alter column amount set not null;
alter table public.financial_opening_balances drop constraint if exists financial_opening_balances_agency_year_month_key;
alter table public.financial_opening_balances add constraint financial_opening_balances_year_month_key unique (year, month);
alter table public.financial_opening_balances drop column if exists closing_amount;
comment on column public.financial_opening_balances.amount is null;
