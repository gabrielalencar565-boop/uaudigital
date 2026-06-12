## Aba Comercial — CRM integrado ao WhatsApp

Nova aba "Comercial" no painel administrativo, funcionando como CRM completo com funil kanban, integração automática com WhatsApp e relatórios.

---

### 1. Navegação e estrutura

- Novo card "Comercial" no `AdminContainer` (ícone `Briefcase` ou `Target`), abrindo o painel `ComercialPanel`.
- Painel com sub-abas internas (Tabs): **Dashboard**, **Funil**, **Leads**, **Tarefas**, **Propostas**, **Relatórios**.
- Filtros globais persistentes no topo: responsável, origem, status, período.

### 2. Dashboard (topo)

Cards de resumo (estilo `FinMetricCard`):
- Leads novos (mês)
- Leads em atendimento
- Propostas enviadas
- Reuniões marcadas
- Clientes fechados
- Vendas perdidas
- Faturamento previsto (soma de `valor_estimado` em etapas ativas, ponderado opcional)
- Taxa de conversão (fechados / total no período)

### 3. Funil kanban

Colunas: Novo lead → Primeiro contato → Qualificação → Diagnóstico → Proposta enviada → Follow-up → Fechado → Perdido.

- Drag-and-drop entre colunas (mesma lib usada em Gestão).
- Card mostra: nome, empresa, valor estimado, responsável (avatar), badge de origem, tempo na etapa, ícone se há tarefa atrasada.
- Mover para **Perdido** abre dialog obrigatório com motivo: preço, sem retorno, fechou com concorrente, sem orçamento, não era o momento, lead sem perfil.

### 4. Cadastro/detalhe do lead

Sheet/Dialog lateral com abas:
- **Resumo**: nome, telefone, empresa, cidade, segmento, interesse, origem, responsável, status, valor estimado, observações.
- **Qualificação**: já investe em marketing (sim/não), orçamento aproximado, principal problema, urgência (baixa/média/alta), nível de interesse (1-5), potencial de fechamento (baixo/médio/alto).
- **WhatsApp**: thread de mensagens (reaproveita componentes do `ConversasPanel`) com composer para responder.
- **Tarefas**: lista de tarefas comerciais do lead, com criar/concluir.
- **Propostas**: lista com valor, data envio, status, anexo, resultado.
- **Histórico**: log de atividades (mudança de etapa, troca de responsável, mensagens, etc).

### 5. Integração automática com WhatsApp

Trigger no `whatsapp_messages` (INSERT direction='in'):
- Se mensagem é de grupo → ignora.
- Procura `crm_leads` por `phone_key`.
- Se NÃO existe E o contato `whatsapp_contacts` não tem `user_id` (não é colaborador): cria lead na etapa `novo_lead` com nome do contato (push name) e telefone.
- Se existe: apenas atualiza `last_message_at` (sem duplicar).

### 6. Tarefas comerciais

- Tabela `crm_tasks` (independente das tarefas de gestão, escopo comercial).
- Tipos: ligação, envio de proposta, follow-up, reunião.
- Aba "Tarefas" lista todas com filtro; atrasadas (`due_at < now()` e não concluídas) em destaque vermelho no topo.

### 7. Propostas

- Tabela `crm_proposals` com valor, enviada_em, status (rascunho/enviada/aceita/recusada), arquivo (storage bucket `crm-proposals`), resultado.

### 8. Relatórios

Aba com gráficos (recharts já no projeto):
- Conversão por etapa (funil bar/funnel chart)
- Leads por origem (pie/bar)
- Vendas por responsável (bar)
- Motivos de perda (bar)
- Ticket médio (kpi + linha mensal)
- Previsão de faturamento (kpi + barras por mês)

---

### Detalhes técnicos

**Migrations (Lovable Cloud):**

```sql
-- enums
create type crm_stage as enum ('novo_lead','primeiro_contato','qualificacao','diagnostico','proposta_enviada','follow_up','fechado','perdido');
create type crm_loss_reason as enum ('preco','sem_retorno','concorrente','sem_orcamento','nao_era_momento','sem_perfil');
create type crm_task_type as enum ('ligacao','proposta','follow_up','reuniao');
create type crm_task_status as enum ('pendente','concluida','cancelada');
create type crm_proposal_status as enum ('rascunho','enviada','aceita','recusada','expirada');
create type crm_urgencia as enum ('baixa','media','alta');
create type crm_potencial as enum ('baixo','medio','alto');

-- crm_leads (nome, telefone, phone_key, empresa, cidade, segmento, interesse, origem,
--  responsavel_id, stage, valor_estimado, observacoes, loss_reason, qualif_* fields, whatsapp_contact_id, ...)
-- crm_tasks (lead_id, tipo, titulo, due_at, status, assigned_user_id)
-- crm_proposals (lead_id, valor, enviada_em, status, arquivo_url, resultado, observacoes)
-- crm_activity_log (lead_id, user_id, action, payload jsonb)
```

Todas com GRANT a `authenticated`/`service_role`, RLS exigindo admin (`has_role(auth.uid(),'admin')`).

**Trigger de auto-criação de lead:**
```sql
create function crm_auto_create_lead_from_message() returns trigger ...
-- após INSERT em whatsapp_messages direction='in', se não-grupo e sem lead existente, cria
```

**Trigger de motivo de perda obrigatório:**
```sql
-- BEFORE UPDATE em crm_leads: se stage='perdido', loss_reason NOT NULL
```

**Frontend (novos arquivos):**
- `src/features/admin/comercial/ComercialPanel.tsx`
- `src/features/admin/comercial/components/ComercialDashboard.tsx`
- `src/features/admin/comercial/components/FunilKanban.tsx`
- `src/features/admin/comercial/components/LeadCard.tsx`
- `src/features/admin/comercial/components/LeadDetailSheet.tsx` (com sub-tabs)
- `src/features/admin/comercial/components/LeadWhatsAppThread.tsx` (reusa lógica de `ConversasPanel`)
- `src/features/admin/comercial/components/LeadQualificacaoForm.tsx`
- `src/features/admin/comercial/components/LeadTasksList.tsx`
- `src/features/admin/comercial/components/LeadProposalsList.tsx`
- `src/features/admin/comercial/components/LossReasonDialog.tsx`
- `src/features/admin/comercial/components/ComercialTasksTab.tsx`
- `src/features/admin/comercial/components/ComercialProposalsTab.tsx`
- `src/features/admin/comercial/components/ComercialRelatoriosTab.tsx`
- `src/features/admin/comercial/hooks/use-crm-leads.ts`
- `src/features/admin/comercial/hooks/use-crm-tasks.ts`
- `src/features/admin/comercial/hooks/use-crm-proposals.ts`
- `src/features/admin/comercial/hooks/use-crm-reports.ts`
- `src/features/admin/comercial/crm-constants.ts` (stages, labels, cores)

**Acesso:** apenas `admin` (consistente com Conversar/WhatsApp).

**Realtime:** ativar replicação em `crm_leads`, `crm_tasks`, `crm_proposals`, `crm_activity_log` para atualizações ao vivo.

**Storage:** bucket privado `crm-proposals` para anexos de propostas.

---

### Perguntas antes de executar

1. **Auto-criação de lead pelo WhatsApp:** devo criar lead para QUALQUER mensagem recebida de número novo (que não seja colaborador nem grupo), ou só quando o número enviar mensagem com alguma palavra-chave/horário comercial?
2. **Responsável comercial padrão:** ao criar lead automaticamente, deixo `responsavel_id = NULL` (entra como "sem dono") ou atribuo a algum admin específico via configuração?
3. **Propostas:** anexo é PDF único por proposta ou múltiplos arquivos?
4. **Visibilidade:** apenas admins, ou criar também o papel `comercial` para colaboradores que só veem a aba Comercial?

Posso assumir defaults (1 = qualquer número novo não-colaborador/não-grupo cria lead; 2 = sem dono; 3 = um arquivo; 4 = apenas admin) e seguir, se preferir.
