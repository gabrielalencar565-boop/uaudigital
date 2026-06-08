# Chat Interno UAU Digital

Sistema de mensagens em tempo real integrado à plataforma, com chat geral da empresa, conversas privadas 1‑a‑1, anexos, status de leitura, presença online, menções e moderação por admins.

## Escopo

### 1. Acesso
- Novo ícone de chat (MessageCircle) ao lado do sino de notificações no header (`UauSidebarShell`).
- Badge com contador de mensagens não lidas (total geral + privadas).
- Clique abre um painel lateral (Sheet à direita no desktop, full‑screen no mobile) com layout em duas colunas: lista de conversas (esquerda) + área da conversa ativa (direita).

### 2. Abas dentro do painel
- **Geral**: chat único da empresa, todos participam.
- **Privado**: lista de colaboradores ativos + últimas conversas; clicar abre a thread privada.
- Campo de busca no topo (filtra colaboradores e conversas pelo nome).

### 3. Mensagens (geral e privadas)
- Texto, emojis (picker), imagens, vídeos, documentos, áudios (gravação via MediaRecorder).
- Anexos até 50MB via Storage bucket `chat-attachments` (privado, URL assinada).
- Responder a mensagem específica (reply‑to com preview).
- Menções `@nome` com autocomplete (notifica o mencionado).
- Mensagens fixadas no Chat Geral (pin/unpin, apenas admin).
- Editar/apagar a própria mensagem; admin pode remover qualquer no Geral.
- Carregamento paginado (50 por página, scroll infinito para cima).

### 4. Status e presença
- Tabela `chat_presence` atualizada a cada 30s via heartbeat; offline após 60s sem ping.
- Online/offline ao lado do avatar.
- Indicador de "digitando…" via canal Realtime broadcast (sem persistir em tabela).
- Estados das mensagens privadas: enviada / entregue / visualizada (✓, ✓✓, ✓✓ azul) baseado em `chat_message_reads`.
- `last_read_at` por participante para badges de não lidas.

### 5. Realtime
- Supabase Realtime (`postgres_changes`) nas tabelas de mensagens e participantes.
- Canal broadcast separado para "typing" e presença leve.
- Invalidate React Query nas mudanças.

### 6. Notificações
- Toast quando chega nova mensagem com painel fechado.
- Badge no ícone do header atualizada em tempo real.
- Som curto opcional (preferência local).

### 7. Admin
- Aba "Moderação" visível apenas para `isAdmin`: lista últimas mensagens do Geral com botão remover, e gerenciamento de fixadas.

## Detalhes técnicos

### Banco de dados (migration)
Tabelas em `public` (todas com GRANT para `authenticated` + `service_role`, RLS habilitada):

- `chat_conversations` — `id`, `type` (`general` | `direct`), `created_at`. Linha única `type='general'` criada no seed.
- `chat_participants` — `conversation_id`, `user_id`, `last_read_at`, `joined_at`. Único `(conversation_id, user_id)`.
- `chat_messages` — `id`, `conversation_id`, `sender_id`, `content`, `reply_to_id`, `is_pinned`, `is_deleted`, `deleted_by`, `created_at`, `edited_at`.
- `chat_message_attachments` — `id`, `message_id`, `storage_path`, `mime_type`, `size_bytes`, `file_name`, `duration_ms` (áudio/vídeo).
- `chat_message_reads` — `message_id`, `user_id`, `read_at` (PK composta).
- `chat_presence` — `user_id` PK, `last_seen_at`, `is_online`.
- `chat_mentions` — `message_id`, `user_id`.

Funções `SECURITY DEFINER`:
- `chat_is_participant(_conv uuid, _uid uuid)` para usar nas policies sem recursão.
- `chat_get_or_create_direct(_other_user uuid)` retorna o id da conversa privada entre o usuário atual e o outro (cria se não existir).
- `chat_mark_read(_conv uuid)` atualiza `last_read_at` e insere reads das mensagens não lidas.

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE` para mensagens, participantes, presença, reads.

Storage: bucket `chat-attachments` privado, policies por participação.

### Frontend
Novos arquivos:
- `src/features/chat/ChatPanel.tsx` — Sheet container com tabs Geral/Privado/Moderação.
- `src/features/chat/components/ConversationList.tsx`
- `src/features/chat/components/ChatThread.tsx`
- `src/features/chat/components/MessageBubble.tsx`
- `src/features/chat/components/MessageComposer.tsx` (texto, emoji, anexo, áudio)
- `src/features/chat/components/PinnedBar.tsx`
- `src/features/chat/components/MentionAutocomplete.tsx`
- `src/features/chat/hooks/useChatConversations.ts`
- `src/features/chat/hooks/useChatMessages.ts` (paginação, realtime)
- `src/features/chat/hooks/useChatUnread.ts`
- `src/features/chat/hooks/useChatPresence.ts` (heartbeat + assinatura)
- `src/features/chat/hooks/useTypingIndicator.ts` (broadcast)

Modificações:
- `src/components/layout/UauSidebarShell.tsx` — adiciona `ChatBellButton` ao lado do sino, monta `<ChatPanel />`.

### Performance / segurança
- React Query com `staleTime` por conversa; cache invalidation seletiva.
- Paginação `range()` 50 mensagens por vez.
- RLS: só participantes leem/escrevem; admin pode soft‑delete e pin no Geral; ninguém vê conversa privada alheia.
- Validação de tamanho e MIME no cliente antes do upload.
- Sanitização de conteúdo renderizado (sem `dangerouslySetInnerHTML`).

### Fora do escopo desta entrega
- Chamadas de áudio/vídeo reais (a estrutura suporta anexo de áudio gravado; WebRTC fica para próxima fase). Estrutura de dados deixa espaço (`chat_calls` pode ser adicionado depois).
- Grupos privados além do Geral (somente 1‑a‑1 e o Geral nesta versão).

## Ordem de execução
1. Migration: tabelas + grants + RLS + funções + storage bucket + realtime + seed da conversa Geral.
2. Hooks (`useChatMessages`, presença, unread).
3. UI do painel e composer.
4. Integração no header + badge.
5. Moderação/admin + pins + menções.
6. QA manual: enviar mensagens entre dois usuários, anexos, presença, badges, mobile.