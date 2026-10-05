-- Editable title/description for the client-approval link preview (WhatsApp & social).
-- Templates may use {cliente}, {mes} (e.g. Out) and {ano}; null = built-in default text.
alter table public.app_settings
  add column link_preview_title text,
  add column link_preview_description text,
  add constraint app_settings_link_preview_title_len check (link_preview_title is null or length(link_preview_title) <= 80),
  add constraint app_settings_link_preview_description_len check (link_preview_description is null or length(link_preview_description) <= 200);
