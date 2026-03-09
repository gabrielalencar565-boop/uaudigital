-- Add slug column to health_score_tokens for cleaner URLs
ALTER TABLE public.health_score_tokens 
  ADD COLUMN slug text UNIQUE;

-- Create function to generate slug from client name
CREATE OR REPLACE FUNCTION generate_health_score_slug()
RETURNS TRIGGER AS $$
DECLARE
  client_name text;
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  -- Get client name
  SELECT name INTO client_name FROM public.clients WHERE id = NEW.client_id;
  
  -- Generate base slug (lowercase, replace spaces with hyphens, remove special chars)
  base_slug := lower(regexp_replace(unaccent(client_name), '[^a-z0-9]+', '-', 'gi'));
  base_slug := trim(both '-' from base_slug);
  
  -- Add month/year suffix
  base_slug := base_slug || '-' || NEW.month || '-' || NEW.year;
  
  final_slug := base_slug;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.health_score_tokens WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER set_health_score_slug
  BEFORE INSERT ON public.health_score_tokens
  FOR EACH ROW
  EXECUTE FUNCTION generate_health_score_slug();

-- Enable unaccent extension for slug generation
CREATE EXTENSION IF NOT EXISTS unaccent;