-- Generating a password-recovery link for another user is account-takeover-adjacent (whoever
-- can call it can reset anyone's password) — too sensitive to expose as a checkbox in
-- Configurações → Permissões. Keeping it hardcoded to admin-only in
-- admin-generate-recovery-link/index.ts instead of wiring it to feature_permissions.
delete from public.feature_permissions where key = 'action_generate_recovery_link';
