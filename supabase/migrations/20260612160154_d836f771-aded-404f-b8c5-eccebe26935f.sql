
-- Backfill group contacts: restore original group ID (with hyphen) from the raw payload.
-- Then fix the xp_first automation to use the corrected group ID.

DO $$
DECLARE
  r record;
  new_phone text;
BEGIN
  FOR r IN SELECT id, phone_e164, name FROM public.whatsapp_contacts WHERE origin = 'grupo' LOOP
    -- Look up the most recent raw->>'phone' for messages of this group (matching by current phone_key).
    SELECT raw->>'phone' INTO new_phone
    FROM public.whatsapp_messages
    WHERE (raw->>'isGroup') = 'true'
      AND whatsapp_phone_key(raw->>'phone') = whatsapp_phone_key(r.phone_e164)
    ORDER BY created_at DESC
    LIMIT 1;

    IF new_phone IS NOT NULL AND new_phone <> r.phone_e164 THEN
      -- Avoid violating unique constraint
      IF NOT EXISTS (SELECT 1 FROM public.whatsapp_contacts WHERE phone_e164 = new_phone AND id <> r.id) THEN
        UPDATE public.whatsapp_contacts
        SET phone_e164 = new_phone
        WHERE id = r.id;
        RAISE NOTICE 'Updated group "%" from % to %', r.name, r.phone_e164, new_phone;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Fix the xp_first automation: replace digits-only group_phone with hyphenated form (from contact).
UPDATE public.whatsapp_automations a
SET group_phone = c.phone_e164
FROM public.whatsapp_contacts c
WHERE a.trigger_key = 'xp_first'
  AND a.audience = 'group'
  AND a.group_phone IS NOT NULL
  AND c.origin = 'grupo'
  AND whatsapp_phone_key(c.phone_e164) = whatsapp_phone_key(a.group_phone)
  AND a.group_phone <> c.phone_e164;
