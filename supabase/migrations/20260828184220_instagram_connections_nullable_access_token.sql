-- "Desconectar Instagram" clears access_token (not just status) so it's an honest
-- data-deletion action instead of a UI toggle — the column needs to allow null for that.
alter table public.instagram_connections alter column access_token drop not null;
