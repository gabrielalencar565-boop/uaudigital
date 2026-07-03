## Correções nas Notificações (sino)

### 1. Clicar em "pedido de análise" não abre o pedido

**Causa:** ao clicar, o sino dispara o evento `open-appeal-review`. O `Index.tsx` reage trocando a aba para "Desempenho", mas o `AdminDeadlineReport` (que escuta o evento e abre o dialog) só é montado depois — quando isso acontece, o evento já foi disparado e ninguém mais o captura. Resultado: aba muda, mas o pedido não abre.

**Correção:** guardar o pedido pendente em um estado global compartilhado (módulo simples com getter/setter + subscribe). Ao clicar na notificação, o sino grava `{ pmTaskId, userId }` nesse store e troca a aba. Quando `AdminDeadlineReport` monta, ele lê o pendente do store, abre o dialog correspondente e limpa o pendente.

Isso é mais confiável que event listener porque não depende de timing de montagem.

### 2. Botão "Limpar notificações"

Adicionar no cabeçalho do dropdown (ao lado do "Marcar tudo como lido") um botão "Limpar" que remove todas as notificações visíveis no momento.

**Como:** reutilizar a tabela existente `notification_dismissals` (hoje só usada para menções no widget) — o sino passa a inserir todas as `notification_key` das notificações listadas. Ao filtrar as notificações do sino, excluir as que estão em `notification_dismissals`.

Comportamento:
- "Limpar" some com todas as notificações atuais do sino (menções, atribuições, atrasos, próximas, pedidos de análise).
- Novas notificações (novo comentário, nova tarefa, novo pedido) continuam aparecendo normalmente — só as dispensadas somem.
- A menção dispensada aqui também some do widget de Menções do Meu Painel (comportamento já existente).

### Arquivos afetados

- **Novo:** `src/lib/pending-appeal-store.ts` — mini-store para o pedido pendente (getter/setter/subscribe).
- `src/components/layout/NotificationsDropdown.tsx`
  - Handler de clique em appeal usa o store em vez do CustomEvent.
  - Nova query de `notification_dismissals` filtrando `notifications`.
  - Nova mutation `dismissAll` + botão "Limpar" no header.
- `src/features/performance/components/AdminDeadlineReport.tsx` — troca `addEventListener("open-appeal-review")` por leitura/subscribe do store.
- `src/features/performance/PerformancePanel.tsx` e `src/pages/Index.tsx` — continuam usando o CustomEvent apenas para trocar a aba (não precisa mexer).

### Fora do escopo

- Widget de Menções (já tem seus próprios botões de limpar/marcar).
- Bell chat (independente).
