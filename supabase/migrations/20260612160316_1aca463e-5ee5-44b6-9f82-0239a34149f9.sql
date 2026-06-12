
ALTER TABLE public.whatsapp_contacts DISABLE TRIGGER whatsapp_contacts_set_phone_key_tr;

UPDATE public.whatsapp_contacts SET phone_e164 = '559982644955-1560491860' WHERE phone_e164 = '5599826449551560491860';
UPDATE public.whatsapp_contacts SET phone_e164 = '120363206668343967-group' WHERE phone_e164 = '120363206668343967';
UPDATE public.whatsapp_contacts SET phone_e164 = '120363359830660608-group' WHERE phone_e164 = '120363359830660608';
UPDATE public.whatsapp_contacts SET phone_e164 = '120363423355775766-group' WHERE phone_e164 = '120363423355775766';

-- Recompute phone_key for the updated rows
UPDATE public.whatsapp_contacts SET phone_key = public.whatsapp_phone_key(phone_e164) WHERE origin = 'grupo';

ALTER TABLE public.whatsapp_contacts ENABLE TRIGGER whatsapp_contacts_set_phone_key_tr;

-- Update the automation to use the corrected group ID
UPDATE public.whatsapp_automations
SET group_phone = '559982644955-1560491860'
WHERE trigger_key = 'xp_first' AND group_phone = '5599826449551560491860';
