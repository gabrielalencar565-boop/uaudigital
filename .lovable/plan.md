

## Plan: Remove "Menu" tab, add "Configurações" tab, fix mobile comments overlap

### Changes

**1. MobileBottomNav.tsx — Remove "Menu", add "Configurações"**
- Remove the `{ key: "menu", ... }` entry from `BOTTOM_TABS`
- Add `{ key: "configuracoes", label: "Config", icon: Settings, tab: "configuracoes" }` as the 5th bottom tab (admin-only, same as current filter logic)
- Remove the entire Drawer component and all drawer-related state/logic (`drawerOpen`, `openGroups`, `DRAWER_NAV`, `filteredDrawerNav`, etc.)
- Update `resolveActiveBottom` to map `configuracoes` → `"configuracoes"`
- For non-admin users, the bottom bar will show 4 tabs (Home, Tarefas, Dashboard, Financeiro)

**2. PmTaskDetailDialog.tsx — Fix "Atividade" comments on mobile**
- Line 1015: The mobile-only comments section passes `comments={[]}` (empty array) instead of the actual `comments` data. Fix by passing the real comments.
- The comments sidebar (line 172) is `hidden md:flex` — on mobile (<768px) it's hidden, which is correct.
- The issue is that `sidebarOpen` subtask panel (line 135-163) uses `hidden sm:flex` — if somehow triggered on mobile, it could overlap. This is already guarded but ensure the sidebar toggle button remains `hidden sm:inline-flex`.
- The main fix: the `TaskContentView` component receives the comments section inline. Need to check if the sidebar overlay is somehow appearing. Will ensure `z-index` and layout don't cause the sidebar to cover the inline comments on mobile.

### Files to edit
- `src/components/layout/MobileBottomNav.tsx` — remove Menu/Drawer, add Configurações tab
- `src/features/gestao/components/PmTaskDetailDialog.tsx` — fix mobile comments passing empty array

