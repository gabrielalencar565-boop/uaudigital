

## Plan: Redesign Link Preview Card — ClickUp-style Widget

Based on the uploaded reference image, the preview card needs to be restructured so:
1. The entire preview (header + image + footer) lives inside a single contained widget/card
2. The action buttons (copy link, open externally, expand) appear in the **top-right corner** of the preview card area — not as a hover overlay on the image center

### Changes — Single file: `PmCommentsSection.tsx`

**1. Move action buttons from image-center overlay to card top-right corner**
- Remove the full-image hover overlay with centered buttons
- Place the 3 action buttons (copy, open link, expand) as small icons in the **top-right of the card header**, visible on card hover (`group-hover`)
- Buttons: link/chain icon, external-link icon, expand icon — matching the reference

**2. Restructure the card layout**
- Keep the card as a single bordered widget with: header → image → description
- Header: avatar/icon + profile name + platform label (left), action buttons (right, visible on hover)
- Remove the "Ver perfil" / "Abrir" button from the header — replace with the hover action icons
- Image: `w-full h-auto max-h-[500px] object-cover`, no overlay on hover
- Footer/description: keep as-is (optional, `line-clamp-2`)

**3. Card-level hover group**
- The outer card div gets `group` class
- Action buttons use `opacity-0 group-hover:opacity-100` to appear only on hover, positioned absolute top-right of the card

### Visual reference (from uploaded image)
```text
┌──────────────────────────────────────┐
│ [avatar] profileName  ...   🔗 ↗ ⤢  │  ← actions top-right, on hover
│                                      │
│           ┌──────────────┐           │
│           │              │           │
│           │   IMAGE      │           │
│           │   (full)     │           │
│           │              │           │
│           └──────────────┘           │
│  description text...                 │
└──────────────────────────────────────┘
```

### Technical details
- Icons to use: `Link2` (copy), `ExternalLink` (open), `Maximize2` (preview/expand)
- Keep YouTube play button overlay on image (non-interactive decoration)
- Card remains fully clickable to open the URL

