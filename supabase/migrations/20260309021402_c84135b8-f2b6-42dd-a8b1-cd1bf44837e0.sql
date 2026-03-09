-- Fix function search_path for security
CREATE OR REPLACE FUNCTION generate_health_score_slug()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_name text;
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  SELECT name INTO client_name FROM public.clients WHERE id = NEW.client_id;
  base_slug := lower(regexp_replace(unaccent(client_name), '[^a-z0-9]+', '-', 'gi'));
  base_slug := trim(both '-' from base_slug);
  base_slug := base_slug || '-' || NEW.month || '-' || NEW.year;
  final_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM public.health_score_tokens WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Move extension to extensions schema
DROP EXTENSION IF EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;