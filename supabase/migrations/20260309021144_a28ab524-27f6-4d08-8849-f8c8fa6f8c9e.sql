-- Update token generation to use shorter 8-character alphanumeric tokens
ALTER TABLE public.health_score_tokens 
  ALTER COLUMN token SET DEFAULT substr(md5(gen_random_uuid()::text), 1, 8);