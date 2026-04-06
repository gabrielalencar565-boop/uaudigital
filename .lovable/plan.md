

## Fix Subtask Completion Detection in Detail Dialog

**Problem**: Two bugs caused by `isDone` being computed as `task.stage_current === "entrega"` (line 258) instead of checking `status_global === "concluido"` for subtasks.

1. **Image 1**: A subtask in "Alteração" marked as concluído doesn't visually register as done in the detail dialog because `isDone` checks the wrong field.
2. **Image 2**: The "Concluído" green button always shows (never switches to "Desmarcar concluído") because `isDone` is always false for subtasks.

**Root cause**: Line 258 — `const isDone = task.stage_current === "entrega"` — this is correct for parent tasks (which advance to "entrega" stage when done), but subtasks use `status_global === "concluido"` without changing their stage.

---

### Change in `src/features/gestao/components/PmTaskDetailDialog.tsx`

**Line ~258**: Update the `isDone` computation to account for subtasks:

```typescript
const isDone = task.parent_task_id
  ? task.status_global === "concluido"
  : task.stage_current === "entrega";
```

This single-line fix ensures:
- Subtasks: `isDone` = true when `status_global` is "concluido" (regardless of stage)
- Parent tasks: `isDone` = true when stage is "entrega" (existing behavior preserved)

All downstream UI (the badge, "Desmarcar concluído" button, "Enviar para Alteração") will then render correctly based on the accurate `isDone` value.

### Also fix in PmSubtaskList.tsx

**Line 168**: Remove the `if (!isAlt)` guard so clicking the circle toggles done even when the subtask is in "alteracoes":

```typescript
// Before: if (!isAlt) { toggleDone(sub); }
// After: always toggle
toggleDone(sub);
```

### Summary
Two small changes in two files. The core fix is making `isDone` check `status_global` for subtasks instead of `stage_current`.

