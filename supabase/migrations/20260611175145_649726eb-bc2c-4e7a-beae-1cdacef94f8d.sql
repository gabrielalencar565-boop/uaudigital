INSERT INTO public.whatsapp_settings (id, enabled, provider, base_url, instance_name, api_key_secret, zapi_client_token_secret, default_country_code, updated_at)
VALUES (1, true, 'zapi', 'https://api.z-api.io', '3F47EA28C94612813409724633E5F542', 'WHATSAPP_API_KEY', 'WHATSAPP_ZAPI_CLIENT_TOKEN', '55', now())
ON CONFLICT (id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  provider = EXCLUDED.provider,
  base_url = EXCLUDED.base_url,
  instance_name = EXCLUDED.instance_name,
  api_key_secret = EXCLUDED.api_key_secret,
  zapi_client_token_secret = EXCLUDED.zapi_client_token_secret,
  default_country_code = EXCLUDED.default_country_code,
  updated_at = now();