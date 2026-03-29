

## Plan: Productivity + Performance on Same Row, Collapsible

### What changes

1. **`MeuPainelPanel.tsx`** — Wrap both widgets in a single row container. Each widget gets a collapsible wrapper with:
   - A compact header bar showing the widget title + chevron icon
   - `useState` defaulting to `collapsed = true` (minimized on load)
   - Clicking the header or chevron toggles open/closed
   - Smooth height transition via CSS (`max-height` or `grid-rows` animation)

2. **Layout** — Keep the existing `grid grid-cols-1 lg:grid-cols-2 gap-4` so they sit side by side on desktop. Each cell contains a collapsible section.

### Technical approach

Create a small `CollapsibleWidget` wrapper component inline or as a shared component:

```text
┌─ Sua produtividade  ──────── ▾ ┐  ┌─ Seu desempenho  ──────── ▾ ┐
│  (collapsed by default)        │  │  (collapsed by default)      │
└────────────────────────────────┘  └──────────────────────────────┘

Click ▾ →

┌─ Sua produtividade  ──────── ▴ ┐  ┌─ Seu desempenho  ──────── ▴ ┐
│  [full widget content]         │  │  [full widget content]       │
│  charts, toggles, etc.        │  │  cards, bars, etc.           │
└────────────────────────────────┘  └──────────────────────────────┘
```

- Each widget keeps its own internal header/content, but the outer wrapper adds the collapse toggle
- The chevron rotates on open (180deg transition)
- Use `overflow-hidden` + `max-height` transition or Radix `Collapsible` (already in the project) for smooth animation

### Files to edit

- `src/features/meu-painel/MeuPainelPanel.tsx` — add collapse state and wrapper around each widget

