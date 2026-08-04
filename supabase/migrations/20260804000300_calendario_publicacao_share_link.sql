-- Fase 2: link público de aprovação para o cliente.

ALTER TABLE public.publication_calendars
  ADD COLUMN share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN share_enabled boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX publication_calendars_share_token_idx ON public.publication_calendars (share_token);

-- Client's own change-request message, distinct from client_note (which is
-- the team writing a note *for* the client to read).
ALTER TABLE public.calendar_publications
  ADD COLUMN client_feedback text,
  ADD COLUMN client_responded_at timestamptz;
