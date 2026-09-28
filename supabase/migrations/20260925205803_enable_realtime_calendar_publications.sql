-- Needed so the client-facing "aprovar"/"pedir alteração" flow (public-calendario-publicacao
-- edge function, writes via service role) shows up live in the team's notification bell and
-- in the Cronograma panel itself, instead of only on next full refetch.
alter publication supabase_realtime add table public.calendar_publications;
