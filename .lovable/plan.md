# Central de Conversas (WhatsApp)

Nova seção no menu lateral exibindo todas as conversas trocadas via Z-API em formato de chat, preparada para futura evolução para atendimento comercial.

## 1. Banco de dados (migration)

**Tabela `whatsapp_contacts`**
- `phone_e164` (PK lógica, único), `name`, `origin` (`colaborador` | `lead` | `cliente` | `desconhecido`), `status` (`ativo` | `arquivado` | `bloqueado`), `user_id` (FK opcional p/ colaborador), `last_message_at`, `unread_count`, `created_at`, `updated_at`.

**Tabela `whatsapp_messages`**
- `contact_phone` (FK lógico), `direction` (`in` | `out`), `body`, `media_url`, `media_type`, `zapi_message_id`, `status` (`pending` | `sent` | `delivered` | `read` | `failed` | `received`), `sent_by_user_id` (quem respondeu pela plataforma), `source_type` (`manual` | `notification` | `webhook`), `source_ref`, `created_at`.

**Acesso**: somente admins (RLS via `has_role`). GRANTs para `authenticated` + `service_role`.

**Trigger**: ao inserir mensagem, atualiza `last_message_at` e (se `direction='in'`) incrementa `unread_count` do contato. Upsert do contato pelo telefone se não existir.

**Backfill**: cada `INSERT` em `whatsapp_outbox`/`whatsapp_send_log` (envios já existentes) também grava em `whatsapp_messages` via trigger, para que toda mensagem disparada apareça no histórico.

## 2. Edge function — webhook Z-API

Nova função pública `whatsapp-webhook` (verify_jwt=false) que recebe os POSTs configurados na Z-API:
- Extrai `phone`, `senderName`, `text.message` / `image.imageUrl` etc.
- Faz upsert do contato.
- Insere `whatsapp_messages` com `direction='in'`.
- Responde 200 rápido.

URL do webhook a configurar na Z-API: `https://<project>.functions.supabase.co/whatsapp-webhook` (mostrada na UI).

A função `whatsapp-dispatch` (envio) passa a também gravar a mensagem enviada em `whatsapp_messages` com `direction='out'` e `status='sent'`.

## 3. UI — `/conversas`

- Item "Conversas" no `UauSidebarShell` (ícone `MessagesSquare`), visível só para admin.
- Página `ConversasPanel`:
  - **Esquerda (lista)**: contatos ordenados por `last_message_at`, avatar/iniciais, último trecho, badge de não lidas, filtros no topo (Todas / Não lidas / Colaboradores / Leads / Clientes), busca por nome/número.
  - **Direita (thread)**: cabeçalho com nome + número + origem; bolhas de mensagens (recebidas à esquerda em `muted`, enviadas à direita em `primary`); horário, status de envio.
  - **Composer**: textarea + botão enviar → chama `whatsapp-dispatch` com `action: 'send'`, registra como `manual`.
  - Botão "Marcar como lida" zera `unread_count`; auto-marca ao abrir a conversa.
  - URL do webhook copiável dentro da aba (atalho de config).

## 4. Detalhes técnicos

- Realtime: `supabase.channel` em `whatsapp_messages` para atualizar a thread aberta + lista.
- React Query keys: `["wa-contacts", filter]`, `["wa-messages", phone]`.
- Filtros baseados em `contact.origin`. Colaboradores são reconhecidos cruzando `phone_e164` com `user_whatsapp_preferences`.
- Sem alterações em código de produção fora dos arquivos novos + sidebar + `whatsapp-dispatch`.

## 5. Fora do escopo desta entrega

- Funil de vendas, tags comerciais, atribuição de atendente, respostas rápidas, automações — a estrutura fica preparada (campos `origin`, `status`, `sent_by_user_id`) mas não é implementada agora.
