

## Problem Analysis

Three issues reported:

1. **Toast notifications (overdue/due-soon) appear on every site visit** — The `checkDeadlines` function runs on mount and generates keys like `overdue-${taskId}-${todayStr}`. While localStorage dedup exists, these are *deadline* notifications that re-trigger because the check runs on every mount AND on every visibility change. The `fetchMissedWhileAway` also re-fetches assignments/mentions since `last-seen`, potentially re-triggering them.

2. **No X button to dismiss toasts** — The `triggerNotification` function in `notifications.ts` uses `sonner` toast without a close/dismiss button.

3. **Opening the bell should auto-mark all as read** — Currently the dropdown only marks as read on individual click or explicit "Mark all" button. User wants opening the popover itself to auto-mark everything read.

---

## Plan

### 1. Fix toast appearing every visit

**File: `src/hooks/use-notification-sound.ts`**

- Remove the initial `checkDeadlines()` call on mount (line 267). Deadline notifications should only fire via realtime or periodic interval, not on page load.
- Remove `fetchMissedWhileAway()` from the `handleVisible` callback on initial load — only run it on subsequent visibility returns. Use a ref (`initialLoadRef`) to skip the first trigger.
- Keep the periodic 5-minute interval for deadline checks (this is fine since localStorage dedup prevents re-showing within the same day).

### 2. Add X close button to toasts

**File: `src/lib/notifications.ts`**

- Add `dismissible: true` to the `toast()` call options. Sonner supports this natively — it renders an X button on the toast.

### 3. Auto-mark all as read when opening the bell

**File: `src/components/layout/NotificationsDropdown.tsx`**

- Add an `onOpenChange` handler to the `<Popover>` component. When the popover opens (`open === true`), automatically call `markAllAsRead` for all unread notification keys.

