

## Plan: Add "Unmark as Completed" option on tasks

**Problem**: When a task reaches the "entrega" (delivered) stage, only a static "Entregue" badge is shown with no way to undo the completion.

**Solution**: Replace the static badge with a button that allows reverting from "entrega" back to the previous stage, reusing the existing `handleRevert` logic.

### Changes

**File: `src/features/gestao/components/PmTaskDetailDialog.tsx`**

1. In the action buttons section (lines 837-841), replace the static "Entregue" badge with a clickable button that calls `handleRevert` to go back to the previous stage
2. Also show the Revert button when `isDone` is true (line 866 currently hides it when `isDone`)

Specifically:
- Lines 837-841: Change the `Badge` to a `Button` styled in emerald with a revert action — something like "Entregue ✓" that on click triggers `handleRevert` to undo completion
- Line 866: Remove the `!isDone &&` condition so the Revert button is also available when the task is in "entrega"

