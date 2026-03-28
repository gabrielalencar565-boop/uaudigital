import { useState } from "react";
import {
  Home, ClipboardList, Eye, DollarSign, Menu,
  CalendarDays, CalendarRange, PieChart, Workflow,
  Target, Trophy, Users, Receipt, FileSpreadsheet,
  ArrowRightLeft, TrendingUp, Settings, UserRound, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MainTab } from "@/components/layout/UauSidebarShell";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose,
} from "@/components/ui/drawer";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

/* ── Sub-tab definitions per bottom tab ── */
const SUB_TABS: Record<string, { key: MainTab; label: string; icon: React.ComponentType<any> }[]> = {
  tarefas: [
    { key: "agenda_gestao", label: "Agenda", icon: CalendarDays },
    { key: "cronograma", label: "Cronograma", icon: CalendarRange },
    { key: "visao_geral_projetos", label: "Squads", icon: PieChart },
    { key: "fluxos", label: "Fluxos", icon: Workflow },
  ],
  dashboard: [
    { key: "magic2", label: "Magic Number", icon: Target },
    { key: "desempenho", label: "Desempenho", icon: Trophy },
  ],
  financeiro: [
    { key: "fin_clientes", label: "Clientes", icon: Users },
    { key: "fin_receitas_despesas", label: "Receitas", icon: Receipt },
    { key: "fin_despesas_detalhadas", label: "Despesas", icon: FileSpreadsheet },
    { key: "fin_lancamentos", label: "Lançamentos", icon: ArrowRightLeft },
    { key: "metas", label: "Metas", icon: TrendingUp },
  ],
};

/* ── Bottom bar items ── */
const BOTTOM_TABS: { key: string; label: string; icon: React.ComponentType<any>; tab?: MainTab }[] = [
  { key: "home", label: "Home", icon: Home, tab: "meu_painel" },
  { key: "tarefas", label: "Tarefas", icon: ClipboardList, tab: "tarefas" },
  { key: "dashboard", label: "Dashboard", icon: Eye, tab: "visao_do_dia" },
  { key: "financeiro", label: "Financeiro", icon: DollarSign, tab: "financeiro" },
  { key: "menu", label: "Menu", icon: Menu },
];

/* ── Drawer nav structure ── */
type DrawerNavItem = {
  key: MainTab;
  label: string;
  icon: React.ComponentType<any>;
  children?: { key: MainTab; label: string; icon: React.ComponentType<any> }[];
  adminOnly?: boolean;
};

const DRAWER_NAV: DrawerNavItem[] = [
  { key: "meu_painel", label: "Meu Painel", icon: UserRound },
  {
    key: "tarefas", label: "Tarefas", icon: ClipboardList,
    children: [
      { key: "agenda_gestao", label: "Agenda", icon: CalendarDays },
      { key: "cronograma", label: "Cronograma", icon: CalendarRange },
      { key: "visao_geral_projetos", label: "Painel de Squads", icon: PieChart },
      { key: "fluxos", label: "Fluxos", icon: Workflow },
    ],
  },
  {
    key: "visao_do_dia", label: "Dashboard", icon: Eye,
    children: [
      { key: "magic2", label: "Magic Number", icon: Target },
      { key: "desempenho", label: "Desempenho", icon: Trophy },
    ],
  },
  {
    key: "financeiro", label: "Financeiro", icon: DollarSign, adminOnly: true,
    children: [
      { key: "fin_clientes", label: "Clientes", icon: Users },
      { key: "fin_receitas_despesas", label: "Receitas & Despesas", icon: Receipt },
      { key: "fin_despesas_detalhadas", label: "Despesas Detalhadas", icon: FileSpreadsheet },
      { key: "fin_lancamentos", label: "Lançamentos", icon: ArrowRightLeft },
      { key: "metas", label: "Metas", icon: TrendingUp },
    ],
  },
  { key: "configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
];

/* ── Helpers ── */
function resolveActiveBottom(tab: MainTab): string {
  const tarefasTabs: MainTab[] = ["tarefas", "agenda_gestao", "cronograma", "visao_geral_projetos", "fluxos"];
  if (tarefasTabs.includes(tab)) return "tarefas";
  const dashTabs: MainTab[] = ["visao_do_dia", "magic2", "desempenho"];
  if (dashTabs.includes(tab)) return "dashboard";
  const finTabs: MainTab[] = ["financeiro", "fin_clientes", "fin_receitas_despesas", "fin_despesas_detalhadas", "fin_lancamentos", "metas"];
  if (finTabs.includes(tab)) return "financeiro";
  if (tab === "meu_painel") return "home";
  return "";
}

interface Props {
  tab: MainTab;
  onTabChange: (t: MainTab) => void;
  isAdmin?: boolean;
}

export function MobileBottomNav({ tab, onTabChange, isAdmin }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const activeKey = resolveActiveBottom(tab);

  const filteredBottomTabs = BOTTOM_TABS.filter((t) => {
    if (t.key === "financeiro" && !isAdmin) return false;
    return true;
  });
  const filteredDrawerNav = DRAWER_NAV.filter((item) => !item.adminOnly || isAdmin);

  const handleBottomTap = (item: typeof BOTTOM_TABS[0]) => {
    if (item.key === "menu") {
      setExpandedGroup(null);
      setDrawerOpen(true);
      return;
    }
    if (item.key === "home") {
      setExpandedGroup(null);
      if (item.tab) onTabChange(item.tab);
      return;
    }
    // Toggle sub-tabs for groups that have them
    const hasSubTabs = !!SUB_TABS[item.key];
    if (hasSubTabs) {
      if (expandedGroup === item.key) {
        setExpandedGroup(null);
      } else {
        setExpandedGroup(item.key);
        if (item.tab) onTabChange(item.tab);
      }
    } else {
      setExpandedGroup(null);
      if (item.tab) onTabChange(item.tab);
    }
  };

  const handleSubTabTap = (key: MainTab) => {
    onTabChange(key);
  };

  const handleDrawerNav = (key: MainTab) => {
    onTabChange(key);
    setDrawerOpen(false);
  };

  const toggleDrawerGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const currentSubTabs = expandedGroup ? (SUB_TABS[expandedGroup] || []) : [];

  return (
    <>
      {/* ── Sub-tab bar (above main pill) ── */}
      {currentSubTabs.length > 0 && (
        <div
          className="fixed inset-x-0 z-[79] flex justify-center pointer-events-none"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)",
          }}
        >
          <div
            className="pointer-events-auto mx-4 flex items-center gap-1.5 overflow-x-auto rounded-full px-2 py-1.5 shadow-lg backdrop-blur-md no-scrollbar"
            style={{ background: "hsla(263, 60%, 35%, 0.85)" }}
          >
            {currentSubTabs.map((sub) => {
              const isActive = tab === sub.key;
              return (
                <button
                  key={sub.key}
                  onClick={() => handleSubTabTap(sub.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-white/25 text-white"
                      : "text-white/60 hover:text-white/90 active:scale-95"
                  )}
                >
                  <sub.icon className="h-3.5 w-3.5" />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Floating pill bottom bar ── */}
      <nav
        className="fixed bottom-4 inset-x-0 z-[80] flex justify-center pointer-events-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div
          className="pointer-events-auto mx-4 flex h-16 w-[calc(100%-2rem)] items-center justify-around rounded-full px-2 shadow-2xl"
          style={{ background: "hsl(263 70% 50%)" }}
        >
          {filteredBottomTabs.map((item) => {
            const active = activeKey === item.key;
            const isExpanded = expandedGroup === item.key;

            return (
              <button
                key={item.key}
                onClick={() => handleBottomTap(item)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 transition-all min-w-[3rem]",
                  active || isExpanded
                    ? "bg-white/20 text-white scale-105"
                    : "text-white/60 hover:text-white/90 active:scale-95"
                )}
                aria-label={item.label}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Drawer (full menu) ── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85svh]">
          <DrawerHeader className="flex items-center justify-between">
            <DrawerTitle className="text-base">Menu</DrawerTitle>
            <DrawerClose asChild>
              <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-8 space-y-1">
            {filteredDrawerNav.map((item) => {
              const active = tab === item.key;
              const hasChildren = !!item.children?.length;
              const groupOpen = !!openGroups[item.key];
              const childActive = item.children?.some((c) => tab === c.key);

              if (!hasChildren) {
                return (
                  <button
                    key={item.key}
                    onClick={() => handleDrawerNav(item.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              }

              return (
                <Collapsible key={item.key} open={groupOpen} onOpenChange={() => toggleDrawerGroup(item.key)}>
                  <div className="flex items-center">
                    <button
                      onClick={() => {
                        handleDrawerNav(item.key);
                        if (!groupOpen) toggleDrawerGroup(item.key);
                      }}
                      className={cn(
                        "flex flex-1 items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors",
                        (active || childActive)
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                    </button>
                    <CollapsibleTrigger asChild>
                      <button className="rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronDown className={cn("h-4 w-4 transition-transform", groupOpen && "rotate-180")} />
                      </button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="ml-7 mt-1 mb-1 space-y-0.5 border-l-2 border-border pl-4">
                      {item.children!.map((child) => {
                        const cActive = tab === child.key;
                        return (
                          <button
                            key={child.key}
                            onClick={() => handleDrawerNav(child.key)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                              cActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <child.icon className="h-4 w-4 shrink-0" />
                            <span>{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
