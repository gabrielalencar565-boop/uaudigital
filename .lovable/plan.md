

## Problem
The delete confirmation `AlertDialog` renders behind the task detail `Dialog` because both are portaled to the body and the Dialog has a higher z-index.

## Fix
Add a `className` with a high z-index to `AlertDialogContent` so it appears above the task detail dialog overlay.

### File: `src/features/gestao/components/PmTaskDetailDialog.tsx`
- Line 193: Change `<AlertDialogContent>` to `<AlertDialogContent className="z-[200]">` to ensure it renders above the Dialog overlay (which is typically z-50).

