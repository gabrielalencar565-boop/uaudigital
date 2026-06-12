## Objetivo
Quando um novo lead for criado no funil Comercial a partir de uma mensagem do WhatsApp, enviar automaticamente uma mensagem inicial de boas-vindas/qualificação, configurável por tipo de cenário, com regras anti-spam, registro no histórico e tarefa de follow-up de 10 minutos para o responsável.

## 1. Banco de dados (nova migration)

### Tabela `crm_lead_automations` (configurações editáveis pelo admin)
Campos principais:
- `scenario` enum: `padrao`, `instagram`, `orcamento`, `fora_horario` (único por cenário)
- `enabled` boolean
- `message_template` text (suporta `{primeiro_nome}`, `{nome_empresa}`, `{origem}`, `{servico_interesse}`)
- `cooldown_days` int (default 30)
- `business_hours_start` time, `business_hours_end` time, `business_days` int[] (apenas no cenário `fora_horario` para detecção; demais usam horário comercial global em `app_settings` ou defaults 09:00–18:00 seg–sex)
- `followup_minutes` int (default 10)
- timestamps + RLS admin-only + GRANTs.

Seed inicial: 4 linhas (uma por cenário) com templates padrão em pt-BR.

### Colunas em `crm_leads`
- `welcome_sent_at timestamptz`
- `welcome_scenario text`

### Tabela `crm_lead_welcome_log`
- `lead_id`, `phone_key`, `scenario`, `sent_at`, `message_id` (referência a `whatsapp_messages`).
- Usada para checar cooldown de 30 dias por `phone_key`.

### Função `crm_should_send_welcome(_lead_id uuid) returns text`
Retorna o cenário a enviar ou `NULL` se não deve. Regras:
1. Lead existe, não está em estágio `perdido`/`fechado`.
2. `welcome_sent_at IS NULL` no próprio lead.
3. `phone_key` não pertence a:
   - Cliente: existe em `clients` (match por nome/telefone) → skip
   - Equipe: `whatsapp_contacts.origin = 'colaborador'` ou `user_id IS NOT NULL` → skip
   - Fornecedor: `whatsapp_contacts.origin = 'fornecedor'` → skip
4. Sem registro em `crm_lead_welcome_log` nos últimos `cooldown_days` para este `phone_key`.
5. Não há mensagem `direction = 'out'` enviada por um humano (não-automação) nos últimos 60 min para o contato → considera "atendimento manual em andamento".
6. Determina cenário (prioridade): `fora_horario` (se mensagem chegou fora do horário) > `orcamento` (corpo da última msg in contém regex `orç|orcamento|preço|valor|quanto custa`) > `instagram` (lead.origem = 'instagram' OU corpo contém `instagram|insta|ig`) > `padrao`.
7. Cenário escolhido precisa estar `enabled = true`.

### Trigger `crm_leads_after_insert_send_welcome`
- AFTER INSERT em `crm_leads`.
- Chama `crm_should_send_welcome`.
- Se cenário retornado: insere em `whatsapp_outbox` (mesmo mecanismo já usado pelas automações), grava `crm_lead_welcome_log`, atualiza `welcome_sent_at`/`welcome_scenario` no lead, e cria uma `crm_tasks` com `tipo = 'followup'`, `due_at = now() + followup_minutes`, `assignee_id = lead.responsavel_id` (ou primeiro admin se NULL), `title = 'Responder lead em até 10 min'`.

### Hook no dispatch
Quando a mensagem do outbox for efetivamente enviada e logada em `whatsapp_messages` (direction = `out`, `meta->>'source' = 'crm_welcome'`), ela já aparece naturalmente no histórico da conversa do `ConversasPanel` e do `LeadWhatsAppThread`. Marcamos `meta` com `{ source: 'crm_welcome', scenario, lead_id }`.

## 2. Frontend — nova sub-aba "Automações" em Comercial

Em `ComercialPanel.tsx` adicionar sub-tab `automacoes`, ao lado de Dashboard/Funil/Tarefas/Propostas/Relatórios.

Novo arquivo `src/features/admin/comercial/components/ComercialAutomacoesTab.tsx`:
- Lista 4 cards (um por cenário) no estilo do `AutomationsCenter`:
  - Toggle ativo/inativo
  - Editor de mensagem com `Textarea` + chips de variáveis (`{primeiro_nome}`, `{nome_empresa}`, `{origem}`, `{servico_interesse}`) e pré-visualização
  - Campo `cooldown_days` (default 30)
  - Campo `followup_minutes` (default 10)
  - Botão "Salvar"
- Hook `use-crm-lead-automations.ts` (list + upsert).

Templates padrão (pt-BR, tom UAU):
- Padrão: "Olá {primeiro_nome}! 👋 Aqui é da UAU Digital. Recebemos sua mensagem e em instantes um especialista vai te responder. Enquanto isso, pode me contar rapidamente qual serviço te interessa?"
- Instagram: "Oi {primeiro_nome}! 💜 Vimos que você veio pelo Instagram. Que bom ter você por aqui! Me conta: o que despertou seu interesse na UAU?"
- Orçamento: "Olá {primeiro_nome}! Recebi seu pedido de orçamento. Para preparar a melhor proposta, me conta um pouco sobre {nome_empresa} e qual serviço você busca?"
- Fora do horário: "Olá {primeiro_nome}! Recebemos sua mensagem fora do nosso horário comercial. Amanhã pela manhã um consultor vai te responder com prioridade. 💜"

## 3. Detalhes técnicos / arquivos

- Migration SQL: cria tabelas/funções/trigger/seed + GRANTs.
- `src/features/admin/comercial/ComercialPanel.tsx` — adiciona sub-tab.
- `src/features/admin/comercial/hooks/use-crm-lead-automations.ts` — novo.
- `src/features/admin/comercial/components/ComercialAutomacoesTab.tsx` — novo.
- `src/features/admin/comercial/crm-constants.ts` — labels dos cenários.

Sem mudanças no edge function `whatsapp-dispatch` (já consome `whatsapp_outbox`).

## 4. Fora do escopo
- Mover automações gerais do WhatsApp.
- Mexer em RLS de tabelas já existentes além de adicionar colunas.

## Pergunta
Confirma os 4 cenários, prioridade e templates padrão acima? Ou prefere ajustar tom/regex de detecção antes de eu implementar?
