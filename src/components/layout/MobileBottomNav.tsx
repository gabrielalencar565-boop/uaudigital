import { useState } from "react";
import {
  Home, ClipboardList, Eye, DollarSign, Menu, Plus,
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

/* ── Quick actions for central FAB ── */
const QUICK_ACTIONS = [
  { label: "Nova tarefa", icon: ClipboardList, tab: "tarefas" as MainTab },
  { label: "Cronograma", icon: CalendarRange, tab: "cronograma" as MainTab },
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
  const [fabOpen, setFabOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const activeKey = resolveActiveBottom(tab);

  const filteredDrawerNav = DRAWER_NAV.filter((item) => !item.adminOnly || isAdmin);
  const filteredBottomTabs = BOTTOM_TABS.filter((t) => {
    if (t.key === "financeiro" && !isAdmin) return false;
    return true;
  });

  const handleBottomTap = (item: typeof BOTTOM_TABS[0]) => {
    if (item.key === "menu") {
      setDrawerOpen(true);
      return;
    }
    if (item.tab) onTabChange(item.tab);
  };

  const handleDrawerNav = (key: MainTab) => {
    onTabChange(key);
    setDrawerOpen(false);
  };

  const toggleDrawerGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      {/* ── FAB overlay ── */}
      {fabOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" onClick={() => setFabOpen(false)}>
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.tab}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabChange(qa.tab);
                  setFabOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-2xl bg-primary px-5 py-3 text-primary-foreground shadow-lg active:scale-95 transition-transform"
              >
                <qa.icon className="h-5 w-5" />
                <span className="text-sm font-semibold">{qa.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-[80] border-t border-border/60 bg-background/95 backdrop-blur-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
          {filteredBottomTabs.map((item, idx) => {
            const isCenter = idx === Math.floor(filteredBottomTabs.length / 2);
            const active = activeKey === item.key;

            // Central FAB button
            if (isCenter) {
              return (
                <div key="fab-wrapper" className="flex items-center gap-0">
                  {/* regular tab before FAB */}
                  <button
                    onClick={() => handleBottomTap(item)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-colors",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {active && <div className="h-0.5 w-5 rounded-full bg-primary mb-0.5" />}
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </button>

                  {/* FAB */}
                  <button
                    onClick={() => setFabOpen((v) => !v)}
                    className={cn(
                      "mx-1 -mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-90",
                      fabOpen && "rotate-45"
                    )}
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                </div>
              );
            }

            return (
              <button
                key={item.key}
                onClick={() => handleBottomTap(item)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-[52px]",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {active && <div className="h-0.5 w-5 rounded-full bg-primary mb-0.5" />}
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
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
