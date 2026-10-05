-- Extra white-label settings for the agency owner (all optional: null = keep the app's default look).
alter table public.app_settings
  add column slogan text,
  add column sidebar_color text,
  add column chart_accent_color text,
  add column header_gradient_from text,
  add column header_gradient_to text,
  add column favicon_url text,
  add constraint app_settings_slogan_len check (slogan is null or length(slogan) <= 80),
  add constraint app_settings_sidebar_color_hex check (sidebar_color is null or sidebar_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint app_settings_chart_accent_hex check (chart_accent_color is null or chart_accent_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint app_settings_header_from_hex check (header_gradient_from is null or header_gradient_from ~ '^#[0-9a-fA-F]{6}$'),
  add constraint app_settings_header_to_hex check (header_gradient_to is null or header_gradient_to ~ '^#[0-9a-fA-F]{6}$');
