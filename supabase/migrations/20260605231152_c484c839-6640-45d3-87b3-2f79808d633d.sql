
-- Restaura contract_start dos clientes baseado na primeira receita registrada
-- (ou no mês do magic_due_date quando não há receitas).
WITH first_rev AS (
  SELECT client_id, MIN(make_date(year, month, 1)) AS start_date
  FROM public.financial_revenues
  GROUP BY client_id
),
inferred AS (
  SELECT
    c.id,
    c.name,
    COALESCE(
      fr.start_date,
      date_trunc('month', c.magic_due_date)::date
    ) AS start_date
  FROM public.clients c
  LEFT JOIN first_rev fr ON fr.client_id = c.id
  WHERE c.is_freelancer_sentinel = false
)
UPDATE public.clients c
SET contract_start = i.start_date
FROM inferred i
WHERE c.id = i.id AND i.start_date IS NOT NULL;

-- Sincroniza com financial_clients (match por id ou nome normalizado)
WITH first_rev AS (
  SELECT client_id, MIN(make_date(year, month, 1)) AS start_date
  FROM public.financial_revenues
  GROUP BY client_id
),
inferred AS (
  SELECT
    c.id,
    c.name,
    COALESCE(fr.start_date, date_trunc('month', c.magic_due_date)::date) AS start_date
  FROM public.clients c
  LEFT JOIN first_rev fr ON fr.client_id = c.id
  WHERE c.is_freelancer_sentinel = false
)
UPDATE public.financial_clients fc
SET contract_start = i.start_date
FROM inferred i
WHERE (fc.id = i.id OR lower(fc.name) = lower(i.name))
  AND i.start_date IS NOT NULL;
