

## Problem Analysis

Three issues in `PmAttachmentsSection.tsx`:

1. **3-dot menu hidden behind image** — the menu button has `z-10` implicitly but needs a higher z-index to sit above the image thumbnail
2. **No rename option** — need to add a "Renomear" menu item that updates `file_name` in `pm_attachments`
3. **Download opens new tab instead of downloading** — the `<a>` tag uses `target="_blank"` which opens in a new tab. Need to fetch the file as a blob and trigger a real download at original resolution

## Plan

### File: `src/features/gestao/components/PmAttachmentsSection.tsx`

1. **Fix z-index on 3-dot menu** — increase z-index on the menu container (line 271) from default to `z-20` so it renders above the image thumbnail.

2. **Add rename functionality**:
   - Add state for `renamingId` and `renameDraft`
   - Add "Renomear" menu item with `<Pencil>` icon in the dropdown
   - When active, replace the filename text in the info bar with an inline `<Input>` that commits on Enter/blur
   - On commit, update `pm_attachments.file_name` via supabase and invalidate query

3. **Fix download to actually download at original resolution**:
   - Replace the `<a href target="_blank">` approach with an `onClick` handler
   - The handler will:
     - Fetch the file via `fetch(url)` → `.blob()`
     - Create an object URL
     - Create a temporary `<a>` element with `download` attribute set to the filename
     - Click it programmatically to trigger a real browser download
   - This ensures the original resolution file is downloaded, not just opened in a new tab

