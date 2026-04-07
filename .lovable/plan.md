

## Destaque visual para tarefas atrasadas na Agenda

### O que será feito

1. **Traçado vermelho nos dias com tarefas atrasadas** — Na grade mensal e semanal (desktop e mobile), os dias anteriores a hoje que possuam tarefas não concluídas recebem uma borda vermelha (`border-destructive/50`).

2. **Badge "X atrasadas" clicável como toggle** — Ao clicar no badge vermelho "X atrasadas" no cabeçalho, ativa-se um modo `highlightOverdue`. Clicar novamente desativa.

3. **Destaque nos cards de tarefas atrasadas** — Quando `highlightOverdue` estiver ativo, os cards cujo `due_date < hoje` e `status_global !== "concluido"` ganham um fundo/borda vermelha sutil (`bg-destructive/10 border-destructive/40`) para se destacarem visualmente.

### Alterações

**Arquivo:** `src/features/gestao/GestaoPanel.tsx`

- Novo estado: `const [highlightOverdue, setHighlightOverdue] = useState(false);`
- Badge "atrasadas" vira `<button>` com `onClick` que alterna `highlightOverdue`. Quando ativo, recebe estilo ring/outline extra.
- Lógica auxiliar: função `isOverdue(task, dayKey)` → `dayKey < todayKey && status_global !== "concluido" && stage_current !== "entrega"`.
- **Grade mensal (desktop):** no `className` da célula do dia, adicionar borda vermelha se o dia tiver tarefas atrasadas: `hasOverdue && "border-destructive/50"`.
- **Grade semanal (desktop):** mesma lógica de borda.
- **Lista mensal (mobile):** mesma lógica de borda.
- **Cards (`renderTaskCard`):** receber parâmetro `dayKey` e, se `highlightOverdue && isOverdue(t, dayKey)`, aplicar `bg-destructive/10 border-destructive/40 ring-1 ring-destructive/30`.

