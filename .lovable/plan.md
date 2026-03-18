

## Plan: Fix PostDetailSidebar — client name in header + full caption with "leia mais"

### Changes

**1. `PostDetailSidebar.tsx` — Add `clientName` prop, show it in header instead of task title**
- Add `clientName?: string` to Props
- In the Instagram-style header: display `clientName` as the bold name (where `post.title` currently shows), and keep `meta.label` (Post/Carrossel/etc) as subtitle
- The avatar initial letter uses `clientName` first char instead of `post.title`

**2. `PostDetailSidebar.tsx` — Show full caption with "leia mais" toggle**
- Replace the truncated caption preview (currently hardcoded to 80 chars) with an expandable system
- Add `expanded` state, default `false`
- When collapsed: show first ~120 chars + clickable "... mais" link
- When expanded: show full plain-text caption + clickable "menos" to collapse
- Keep the `SmartCaptionEditor` below in the "Legenda" section for editing

**3. Pass `clientName` from parents:**
- `PmCronogramaTab.tsx` — already has `clientName` prop, pass it to `<PostDetailSidebar clientName={clientName} />`
- `CronogramaClientBrowser.tsx` — has `clientsMap` and can resolve `resolvedSelected.client_id`, pass `clientName={clientsMap[resolvedSelected.client_id] ?? ""}` to `<PostDetailSidebar />`

### Files to edit
- `src/features/gestao/components/cronograma/PostDetailSidebar.tsx`
- `src/features/gestao/components/PmCronogramaTab.tsx`
- `src/features/gestao/components/cronograma/CronogramaClientBrowser.tsx`

