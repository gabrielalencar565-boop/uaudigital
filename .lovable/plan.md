

## Fix: Dropdown menu clipped behind attachment card

**Root cause**: The attachment card container has `overflow-hidden` (line 284), which clips the dropdown menu content that renders inside it.

**Solution**: Remove `overflow-hidden` from the card wrapper div. To preserve the rounded corners on the image thumbnail, add `overflow-hidden` and `rounded-t-md` directly on the image container instead.

### Changes in `src/features/gestao/components/PmAttachmentsSection.tsx`

1. **Line 284** — Remove `overflow-hidden` from the card's className
2. **Image container (~line 298)** — Add `overflow-hidden rounded-t-md` to the image `<div>` so images still clip to rounded corners
3. **Non-image container (~line 304)** — Add `overflow-hidden rounded-t-md` similarly

This is a 1-file, 3-line change.

