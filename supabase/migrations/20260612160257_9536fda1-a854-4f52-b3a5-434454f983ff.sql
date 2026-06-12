
WITH group_raw AS (
  SELECT DISTINCT ON (regexp_replace(raw->>'phone','\D','','g'))
    regexp_replace(raw->>'phone','\D','','g') AS digits,
    raw->>'phone' AS original
  FROM public.whatsapp_messages
  WHERE (raw->>'isGroup') = 'true'
    AND position('-' in (raw->>'phone')) > 0
  ORDER BY regexp_replace(raw->>'phone','\D','','g'), created_at DESC
)
UPDATE public.whatsapp_contacts c
SET phone_e164 = g.original
FROM group_raw g
WHERE c.origin = 'grupo'
  AND regexp_replace(c.phone_e164,'\D','','g') = g.digits
  AND c.phone_e164 <> g.original
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_contacts c2 WHERE c2.phone_e164 = g.original AND c2.id <> c.id);

UPDATE public.whatsapp_automations a
SET group_phone = c.phone_e164
FROM public.whatsapp_contacts c
WHERE a.trigger_key = 'xp_first'
  AND a.audience = 'group'
  AND c.origin = 'grupo'
  AND regexp_replace(c.phone_e164,'\D','','g') = regexp_replace(a.group_phone,'\D','','g')
  AND a.group_phone <> c.phone_e164;
