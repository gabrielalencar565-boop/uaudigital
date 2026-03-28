

## Plan: Widen bottom nav pill + show sub-tabs on tap

### What changes

**1. Increase pill width**
- Change the pill container from auto-width to `mx-4 w-[calc(100%-2rem)]` so it stretches nearly edge-to-edge while keeping the rounded-full floating look.
- Increase button touch targets from `h-10 w-10` to include labels beneath icons (icon + small text, like modern app nav bars).

**2. Show sub-tabs inline when tapping a parent tab**
- When the user taps "Tarefas", "Dashboard", or "Financeiro":
  - Navigate to the parent tab (current behavior).
  - Show a secondary horizontal scrollable bar just above the pill, displaying the sub-tabs for that group (e.g., Agenda, Cronograma, Painel de Squads, Fluxos for Tarefas).
  - Tapping a sub-tab navigates to it; tapping the same parent again or another parent collapses/replaces the sub-tabs.
- "Home" and "Menu" have no sub-tabs — they work as before.

**3. Sub-tab bar design**
- A second floating pill (or semi-transparent bar) positioned just above the main pill (`bottom: ~5.5rem`).
- Same purple tint but slightly translucent (`bg-purple-900/80 backdrop-blur`).
- Horizontally scrollable with `overflow-x-auto`, small rounded chips for each sub-tab.
- Active sub-tab highlighted with `bg-white/20`.

### Files to edit

- `src/components/layout/MobileBottomNav.tsx` — all changes are here.

### Technical details

- Add state `expandedGroup: string | null` to track which parent's sub-tabs are showing.
- Map from bottom tab key → children array (reuse `DRAWER_NAV` children).
- On tap: if same group already expanded, collapse it; otherwise expand new group and navigate to parent tab.
- Sub-tab bar renders conditionally above the main pill with `AnimatePresence`-style transition (or CSS transition).
- Each bottom tab button gets a column layout: icon on top, label below (`flex-col gap-0.5`, `text-[10px]`), increasing effective width per item.

