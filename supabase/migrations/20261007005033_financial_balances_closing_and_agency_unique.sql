-- Saldo final do banco por mês (amount continua sendo o saldo inicial) e unicidade por agência, não global.
alter table public.financial_opening_balances add column if not exists closing_amount numeric;
comment on column public.financial_opening_balances.amount is 'Saldo inicial do mês (extrato do banco)';
comment on column public.financial_opening_balances.closing_amount is 'Saldo final do mês (extrato do banco); null = não informado';
alter table public.financial_opening_balances drop constraint if exists financial_opening_balances_year_month_key;
alter table public.financial_opening_balances add constraint financial_opening_balances_agency_year_month_key unique (agency_id, year, month);
