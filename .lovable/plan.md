

## Plan: Trash Panel Improvements + Agenda Filter Fix

### Problem 1: Trash Panel — Show who deleted + Admin-only destructive actions
The trash panel currently shows the assigned user but not who deleted the task. Also, "Esvaziar Lixeira" and "Excluir permanentemente" buttons are available to all users — they should be admin-only.

### Problem 2: Agenda filter not working for Feb/March
In `GestaoPanel.tsx`, legacy tasks from the `tasks` table are added to `tasksByDay` without going through the assignee/client/search filters. The `filteredTasks` memo only filters `pm_tasks`, but legacy tasks are appended raw. This causes all legacy tasks to appear regardless of filter selection.

---

### Changes

**File 1: `src/features/agenda/components/TaskTrashPanel.tsx`**
- Accept `isAdmin` prop (boolean)
- Display "Excluída por: [name]" using `deleted_by` field mapped through `teamByUserId`
- Conditionally render "Esvaziar Lixeira" button only when `isAdmin === true`
- Conditionally render per-task "Excluir permanentemente" button only when `isAdmin === true`
- Keep "Restaurar" available to all users

**File 2: `src/features/gestao/GestaoPanel.tsx`** (AgendaCalendarView)
- Apply the same client/assignee/search filters to legacy tasks before adding them to `tasksByDay`
- In the legacy task loop (~line 549), filter by `filterClient`, `filterAssignee` (checking both `assigned_user_id` and extra assignees from `legacyAssigneesByTaskId`), and `search` before converting to PmTask shape

**File 3: `src/features/gestao/GestaoPanel.tsx`** (TrashPanel usage)
- Pass `isAdmin` prop to `<TaskTrashPanel>` where it's rendered

**File 4: `src/features/agenda/AgendaPanel.tsx`** (if TrashPanel is also used here)
- Pass `isAdmin` prop to `<TaskTrashPanel>` where it's rendered

