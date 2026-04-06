

## Fix Subtask Action Buttons

**Problem**: When viewing a subtask in the detail dialog, the action buttons show "Concluído >" (which advances to next stage) and "Reverter" — these are parent-task behaviors. Subtasks should only toggle done/undone and optionally send to Alteração, without stage advancement.

**Reference**: The screenshot shows the subtask detail with "Concluído >" and "Reverter" buttons that shouldn't be there.

---

### Changes in `src/features/gestao/components/PmTaskDetailDialog.tsx`

**1. Detect subtask context**: Use `task.parent_task_id` to determine if the current task is a subtask.

**2. Replace action buttons for subtasks** (lines ~1166-1283): When `task.parent_task_id` is set, render a different button set:
- **If not done**: Show "Concluído" button (no chevron, no stage advance) that toggles `status_global` to `concluido` and triggers scoring. Also show "Enviar para Alteração" button.
- **If done**: Show "Desmarcar concluído" button to set `status_global` back to `backlog`. Also show "Enviar para Alteração" button.
- **If in alteracoes**: Show "Em Alteração" badge + "Marcar como concluído" button (toggles done) — no "Reverter".
- **Remove "Reverter" entirely** for subtasks.

**3. Subtask toggle logic**: Add a `handleSubtaskToggleDone` function that:
- Toggles `status_global` between `concluido` and `backlog`
- Keeps `stage_current` unchanged
- Triggers scoring via `syncStage` when marking as done
- Shows appropriate toast

**4. Subtask send to Alteração**: Add `handleSubtaskAlteracao` that sets `stage_current` to `alteracoes` and `status_global` to `backlog`, applying fixed assignees from flow config.

### Summary
One file edited. The core change is wrapping the existing action buttons section (lines 1166-1283) in a conditional: if `task.parent_task_id` exists, render the simplified subtask buttons; otherwise, render the existing parent-task workflow buttons unchanged.

