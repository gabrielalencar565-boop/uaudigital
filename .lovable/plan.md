## Objetivo

Melhorar o chat com presença online/offline na aba Privado, notificação sonora + toast ao chegar mensagens novas, e garantir a opção de apagar mensagens.

## 1. Aba Privado — Online / Offline

Em `src/features/chat/ChatPanel.tsx` (lista lateral da aba "Privado"):

- Usar `useChatPresence()` + `isUserOnline()` (já existem) para classificar cada membro de `useTeamMembers()`.
- Renderizar em dois grupos com cabeçalhos:
  - **Online agora** (bolinha verde no avatar)
  - **Offline** (bolinha cinza, opacidade reduzida)
- Ordenar cada grupo por nome. Excluir o próprio usuário.
- "Online" = registro em `chat_presence` com `is_online=true` e `last_seen_at` nos últimos 60s — já é a regra do hook.
- O heartbeat já roda a cada 30s enquanto a aba está aberta (`useChatPresence`). Adicionar também listener de `visibilitychange`: quando `document.hidden` → marcar `is_online=false`; ao voltar → ping imediato. Isso garante "aba aberta = online".

## 2. Som + Toast ao receber mensagens novas

Criar hook `src/features/chat/hooks/useChatNotifier.ts` montado uma única vez no `TopBar` (junto do `ChatBellButton`):

- Assina Realtime global em `chat_messages` (INSERT).
- Para cada nova mensagem:
  - Ignora se `sender_id === currentUserId`.
  - Ignora se o painel de chat está aberto **na mesma conversa** (estado compartilhado simples via `window`/Zustand leve, ou flag em `localStorage` setada pelo `ChatPanel`).
  - Toca `playNotificationSound()` (já existe em `src/lib/notifications.ts`).
  - Dispara `toast()` (sonner) no canto superior direito com avatar + nome do remetente + prévia (até 80 chars) + label "Chat Geral" ou nome do remetente para privado. Clique no toast abre o `ChatPanel` na conversa correspondente (via evento custom `window.dispatchEvent(new CustomEvent("uau:open-chat", { detail: { conversationId } }))`, escutado pelo `ChatBellButton`/`ChatPanel`).
- Verifica se a conversa pertence ao usuário consultando `chat_participants` (cache via React Query) para não notificar de conversas alheias.

Reuso: usar `triggerNotification` adaptando — ou chamar `playNotificationSound()` + `toast()` diretamente para customizar com avatar.

## 3. Apagar mensagem

A função já existe em `MessageBubble.tsx` (ícone lixeira → `deleteChatMessage`). Ajustes:

- Tornar o botão sempre visível em mobile (hoje só aparece em `group-hover`) — adicionar variante "sempre visível" em telas <md.
- Trocar `confirm()` nativo por `AlertDialog` do shadcn para combinar com o resto do app.
- Admin pode apagar qualquer mensagem no Geral (já implementado); usuário comum apaga só as próprias (já implementado).

## Arquivos

- editar `src/features/chat/ChatPanel.tsx` — grupos Online/Offline na aba Privado
- editar `src/features/chat/hooks/useChatPresence.ts` — listener `visibilitychange`
- criar `src/features/chat/hooks/useChatNotifier.ts` — som + toast global
- editar `src/components/layout/TopBar.tsx` — montar `useChatNotifier()`
- editar `src/features/chat/components/MessageBubble.tsx` — AlertDialog + botão visível no mobile

## Fora do escopo

Notificações nativas do navegador (Notification API) e push quando a aba está fechada — pode ser feito depois.
