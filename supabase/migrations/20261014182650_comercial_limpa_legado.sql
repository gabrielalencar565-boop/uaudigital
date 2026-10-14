-- Limpeza do comercial antigo: conversas do WhatsApp (sem API conectada desde 11/07), leads, tarefas e boas-vindas do CRM antigo.
-- O novo CRM (comercial_*) fica como único. Antes de apagar, uma cópia vai para o schema legacy_backup, que a API não expõe
-- (sem acesso para anon/authenticated); quando não for mais necessária, basta: drop schema legacy_backup cascade;
--
-- Continua valendo: a criação do lead antigo a partir de mensagem recebida (alimenta o espelho no novo CRM), whatsapp_settings,
-- whatsapp_outbox / whatsapp_send_log e whatsapp_automations (avisos para a equipe: tarefas, prazos e ranking).

create schema if not exists legacy_backup;
revoke all on schema legacy_backup from public, anon, authenticated;

create table legacy_backup.whatsapp_contacts as table public.whatsapp_contacts;
create table legacy_backup.whatsapp_messages as table public.whatsapp_messages;
create table legacy_backup.crm_leads as table public.crm_leads;
create table legacy_backup.crm_lead_automations as table public.crm_lead_automations;
create table legacy_backup.crm_lead_welcome_log as table public.crm_lead_welcome_log;
create table legacy_backup.crm_tasks as table public.crm_tasks;
create table legacy_backup.crm_activity_log as table public.crm_activity_log;
revoke all on all tables in schema legacy_backup from public, anon, authenticated;

-- as boas-vindas antigas (fora do horário, orçamento, Instagram, padrão) saem de cena: quem responde ao lead agora é a automação do novo CRM
alter table public.crm_leads disable trigger trg_crm_leads_after_insert_welcome;

delete from public.crm_leads;               -- leva junto tarefas, propostas, histórico e log de boas-vindas (on delete cascade)
delete from public.crm_lead_automations;
delete from public.whatsapp_messages;
delete from public.whatsapp_contacts;
