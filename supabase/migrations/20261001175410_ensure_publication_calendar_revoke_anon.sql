-- This project auto-grants EXECUTE to anon/authenticated/postgres on new public-schema
-- functions (default privileges) — REVOKE ALL FROM PUBLIC in the function's own creation
-- migration doesn't touch those role-specific grants, only the implicit PUBLIC pseudo-role.
-- Confirmed via get_advisors: anon could call this SECURITY DEFINER function directly
-- (unauthenticated clients have no business creating/looking up a client's Cronograma
-- calendars). Explicit REVOKE FROM anon is what the rest of this codebase already does for
-- this exact class of issue (e.g. xp_video_destaque_revoke_anon).
REVOKE EXECUTE ON FUNCTION public.ensure_publication_calendar(uuid, date) FROM anon;
