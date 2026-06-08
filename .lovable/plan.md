## Objetivo

1. Lista de offline ordenada por quem entrou (esteve online) mais recentemente.
2. Bolinha verde de presença também sobre o avatar no cabeçalho da conversa privada.
3. Garantir que toda mensagem nova mostre notificação no canto superior direito + som (já existe; revisar para confirmar que aparece mesmo com chat fechado e com o painel aberto em outra conversa).
4. Em **Configurações do usuário**, criar a seção **Sons de notificação** com:
   - escolha de som para **Chat**
   - escolha de som para **Tarefas** (atribuição, atrasada, vence em breve, menção)
   - botão para **desligar** o som de cada categoria de forma independente
   - botão "Tocar" para pré-ouvir cada opção

## Mudanças

### 1. Ordenação Offline por "último online" — `src/features/chat/ChatPanel.tsx`
No `useMemo` que separa `online` / `offline`, alterar o `sortFn` da lista offline para ordenar por `presence?.[user_id]?.last_seen_at` **desc** (quem ficou online mais recentemente primeiro), com fallback alfabético quando não há `last_seen_at`.

### 2. Bolinha de presença no header da conversa privada — `src/features/chat/ChatPanel.tsx`
No `headerSlot` da aba Privado, envolver o `<Avatar>` num `relative` e adicionar a mesma bolinha (`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500/bg-muted-foreground/40`) já usada no `renderMemberRow`. Manter o texto "Online / visto por último…" abaixo.

### 3. Sistema de sons multi-categoria — `src/lib/notifications.ts`

Refatorar para suportar **categorias** (`chat` e `task`) com som configurável independentemente:

- Nova função `playCategorySound(category: "chat" | "task")` que:
  - lê `localStorage.getItem("uau:notif:sound:<category>")` → `"off"` ou id do som
  - debounce por categoria
  - toca o som correspondente
- Catálogo de sons disponíveis (sem precisar de novos assets — sintetizados via Web Audio API, mesmo padrão do `playTrashSound` já existente):
  - `default` — usa `/sounds/notification.mp3` (atual)
  - `ping` — sinusoide curta 880Hz
  - `pop` — clique curto filtrado
  - `chime` — duas notas (E5 → G5)
  - `bell` — sino com harmônicos decaindo
  - `soft` — pulse suave 440Hz baixo volume
- Exportar `NOTIFICATION_SOUNDS: { id, label, preview(): void }[]` para o painel.
- Manter `playNotificationSound()` por compatibilidade: chama `playCategorySound("task")`.
- Adicionar `playChatSound()` → `playCategorySound("chat")`.
- `isSoundEnabled` antigo (chave `uau:notif:sound`) continua como kill-switch global — se `"false"` silencia tudo.

### 4. Usar `playChatSound` no chat — `src/features/chat/hooks/useChatNotifier.ts`
Trocar `playNotificationSound()` por `playChatSound()`. O toast já usa `position: "top-right"` via `triggerNotification`; o toast manual aqui também já tem `position: "top-right"` — confirmar e manter.

### 5. Confirmar fluxo de notificações
- `useChatNotifier` é montado no `ChatBellButton` (sempre presente no `TopBar`) → garante que a notificação aparece mesmo com painel fechado. Revisar e manter.
- Toast aparece no canto superior direito (já está `top-right`).
- Suprimir apenas quando a conversa exata está aberta e o tab está visível (lógica atual via `active-chat-state`).

### 6. UI em Configurações — `src/features/configuracoes/ConfiguracoesPanel.tsx`
Adicionar novo `<Card>` "Sons de notificação" com duas linhas (Chat / Tarefas). Cada linha:
- `Label` + `Select` (shadcn) com as opções do catálogo + opção "Desligado"
- Botão `Tocar` (Play icon) que chama `sound.preview()`
- Persistir imediatamente em `localStorage` via helpers novos `getCategorySound(cat)` / `setCategorySound(cat, id|"off")`
- Toast de confirmação ao salvar

Sem migração de banco — preferências ficam no `localStorage` por dispositivo (mesmo padrão do toggle de som atual).

## Arquivos tocados

- `src/lib/notifications.ts` — refactor catálogo + categorias
- `src/features/chat/ChatPanel.tsx` — sort offline, bolinha no header
- `src/features/chat/hooks/useChatNotifier.ts` — `playChatSound`
- `src/features/configuracoes/ConfiguracoesPanel.tsx` — novo card de sons
