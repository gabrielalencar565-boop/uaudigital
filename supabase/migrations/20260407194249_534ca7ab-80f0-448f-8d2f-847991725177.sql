
-- Fix: unmark Design for Melri April 2026 (was incorrectly set by extra demand)
UPDATE public.magic2_cycle_stages
SET completed = false, completed_at = null, completed_by = null, updated_at = now()
WHERE cycle_id = (
  SELECT cy.id FROM magic2_cycles cy
  JOIN magic2_client_links l ON l.magic2_client_id = cy.client_id
  JOIN clients c ON c.id = l.agenda_client_id
  WHERE c.name ILIKE '%melri%' AND cy.year = 2026 AND cy.month = 4
  LIMIT 1
)
AND stage = 'design'
AND completed = true;
