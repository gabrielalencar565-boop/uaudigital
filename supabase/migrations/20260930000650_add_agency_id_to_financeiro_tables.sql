alter table public.financial_clients add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.financial_revenues add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.financial_expenses add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.financial_transactions add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.financial_goals add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.financial_credit_cards add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.financial_opening_balances add column agency_id uuid references public.agencies(id) default public.current_agency_id();
alter table public.mrr_movements add column agency_id uuid references public.agencies(id) default public.current_agency_id();
