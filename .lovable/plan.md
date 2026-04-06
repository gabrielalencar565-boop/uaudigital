

## Fix Subtask Completion Priority Over Alteração State

**Problem**: When a subtask in "Alteração" is marked as concluído, it still shows the "Em Alteração" badge instead of showing as completed. The completion state should take priority over the stage state.

**Root cause**: In the conditional rendering (line 1170), `stage_current === "alteracoes"` is checked **before** `isDone`. So even when the subtask is done, if its stage is "alteracoes", it renders the "Em Alteração" UI instead of the "Concluído" UI.

---

### Change in `src/features/gestao/components/PmTaskDetailDialog.tsx`

**Reorder the conditional** (lines 1170-1228): Check `isDone` **first**, then check `alteracoes` stage.

Current order:
1. `alteracoes` → show "Em Alteração" badge (even if done)
2. `isDone` → show "Concluído" badge + "Desmarcar"
3. else → show "Concluído" button + "Enviar para Alteração"

New order:
1. `isDone` → show "Concluído" badge + "Desmarcar concluído" + "Enviar para Alteração" (always, regardless of stage)
2. `alteracoes` → show "Em Alteração" badge + "Concluído" button
3. else → show "Concluído" button + "Enviar para Alteração"

This ensures that once marked as done, the subtask always displays as completed with the option to unmark, regardless of which stage it was in.

### Summary
One file, one conditional reorder. Move the `isDone` check to be the first branch so completion always takes visual priority.

