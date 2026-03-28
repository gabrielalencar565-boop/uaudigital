

## Plan: Fix image viewer z-index, improve performance & realtime

### Changes

**1. PmImageViewer.tsx — Fix image appearing behind task dialog**
- Add `z-[200]` to the `DialogContent` so the fullscreen image viewer renders above the task dialog (`z-[120]`).
- On mobile, ensure touch targets for prev/next arrows are large enough (`h-12 w-12`).
- Download button already exists — no changes needed for that.

**2. PmAttachmentsSection.tsx — Mobile attachment grid**
- Change grid from `grid-cols-4 sm:grid-cols-5` to `grid-cols-3 sm:grid-cols-4 md:grid-cols-5` so thumbnails are larger and tappable on small screens.
- Make the 3-dot menu always visible on mobile (not just on hover) since there's no hover on touch.

**3. PostDetailSidebar.tsx — Same image viewer z-index fix**
- The `PmImageViewer` used here will inherit the fix from step 1.

**4. Performance — Reduce unnecessary re-renders & optimize queries**
- In `query-client.ts`: reduce `staleTime` from 2min to 30s for faster data freshness while still deduping rapid navigations.
- The realtime sync is already configured for all tables — no changes needed there.

### Files to edit
- `src/features/gestao/components/PmImageViewer.tsx` — add `z-[200]` to DialogContent
- `src/features/gestao/components/PmAttachmentsSection.tsx` — responsive grid fix, mobile menu visibility
- `src/lib/query-client.ts` — reduce staleTime to 30s for snappier updates

