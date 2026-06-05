import { useState } from "react";
import {
  Home, ClipboardList, Eye, DollarSign,
  CalendarDays, CalendarRange, PieChart, Workflow,
  Target, Trophy, Users, Receipt, FileSpreadsheet,
  ArrowRightLeft, TrendingUp, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MainTab } from "@/components/layout/UauSidebarShell";

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
    { key: "fin_receitas_despesas", label: "Receitas", icon: Receipt },
    { key: "fin_despesas_detalhadas", label: "Despesas", icon: FileSpreadsheet },
    { key: "fin_lancamentos", label: "Lançamentos", icon: ArrowRightLeft },
    { key: "metas", label: "Metas", icon: TrendingUp },
  ],
};

/* ── Bottom bar items ── */
const BOTTOM_TABS: { key: string; label: string; icon: React.ComponentType<any>; tab?: MainTab; adminOnly?: boolean }[] = [
  { key: "home", label: "Home", icon: Home, tab: "meu_painel" },
  { key: "tarefas", label: "Tarefas", icon: ClipboardList, tab: "tarefas" },
  { key: "dashboard", label: "Dashboard", icon: Eye, tab: "visao_do_dia" },
  { key: "financeiro", label: "Financeiro", icon: DollarSign, tab: "financeiro", adminOnly: true },
  { key: "configuracoes", label: "Config", icon: Settings, tab: "configuracoes", adminOnly: true },
];

/* ── Helpers ── */
function resolveActiveBottom(tab: MainTab): string {
  const tarefasTabs: MainTab[] = ["tarefas", "agenda_gestao", "cronograma", "visao_geral_projetos", "fluxos"];
  if (tarefasTabs.includes(tab)) return "tarefas";
  const dashTabs: MainTab[] = ["visao_do_dia", "magic2", "desempenho"];
  if (dashTabs.includes(tab)) return "dashboard";
  const finTabs: MainTab[] = ["financeiro", "fin_receitas_despesas", "fin_despesas_detalhadas", "fin_lancamentos", "metas"];
  if (finTabs.includes(tab)) return "financeiro";
  if (tab === "meu_painel") return "home";
  if (tab === "configuracoes") return "configuracoes";
  return "";
}

interface Props {
  tab: MainTab;
  onTabChange: (t: MainTab) => void;
  isAdmin?: boolean;
}

export function MobileBottomNav({ tab, onTabChange, isAdmin }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const activeKey = resolveActiveBottom(tab);

  const filteredBottomTabs = BOTTOM_TABS.filter((t) => {
    if (t.adminOnly && !isAdmin) return false;
    return true;
  });

  const handleBottomTap = (item: typeof BOTTOM_TABS[0]) => {
    if (item.key === "home" || item.key === "configuracoes") {
      setExpandedGroup(null);
      if (item.tab) onTabChange(item.tab);
      return;
    }
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

  const currentSubTabs = expandedGroup ? (SUB_TABS[expandedGroup] || []) : [];

  return (
    <>
      {/* ── Sub-tab bar (above main pill) ── */}
      {currentSubTabs.length > 0 && (
        <div
          className="fixed inset-x-0 z-[79] flex justify-center pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
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
    </>
  );
}
