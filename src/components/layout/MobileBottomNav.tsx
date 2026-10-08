import { useState } from "react";
import {
  Home, ClipboardList, Eye, DollarSign,
  CalendarDays, PieChart, Workflow,
  Target, Trophy, Users, Receipt, FileSpreadsheet,
  ArrowRightLeft, TrendingUp, Settings, Briefcase, Ellipsis, CircleHelp, ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { MainTab } from "@/components/layout/UauSidebarShell";
import { useAppSettings } from "@/features/data/queries";

/* ── Sub-tab definitions per bottom tab ── */
const SUB_TABS: Record<string, { key: MainTab; label: string; icon: React.ComponentType<any> }[]> = {
  tarefas: [
    { key: "agenda_gestao", label: "Agenda", icon: CalendarDays },
    { key: "pauta_pessoas", label: "Pauta", icon: ClipboardList },
  ],
  dashboard: [
    { key: "visao_do_dia", label: "Visão do Dia", icon: Eye },
    { key: "magic2", label: "Magic Number", icon: Target },
    { key: "desempenho", label: "Desempenho", icon: Trophy },
    { key: "visao_geral_projetos", label: "Squads", icon: PieChart },
  ],
  financeiro: [
    { key: "fin_receitas_despesas", label: "Receitas", icon: Receipt },
    { key: "fin_despesas_detalhadas", label: "Despesas", icon: FileSpreadsheet },
    { key: "fin_lancamentos", label: "Lançamentos", icon: ArrowRightLeft },
    { key: "metas", label: "Metas", icon: TrendingUp },
  ],
};

/* ── Bottom bar items ── */
// Five slots only: what is used all day stays one tap away; everything else lives in the "Mais" sheet.
const BOTTOM_TABS: { key: string; label: string; icon: React.ComponentType<any>; tab?: MainTab }[] = [
  { key: "home", label: "Home", icon: Home, tab: "meu_painel" },
  { key: "tarefas", label: "Tarefas", icon: CalendarDays, tab: "agenda_gestao" },
  { key: "clientes", label: "Clientes", icon: Users, tab: "clientes" },
  { key: "dashboard", label: "Dashboard", icon: Eye, tab: "visao_do_dia" },
  { key: "mais", label: "Mais", icon: Ellipsis },
];

const FIN_TABS: MainTab[] = ["financeiro", "fin_receitas_despesas", "fin_despesas_detalhadas", "fin_lancamentos", "metas"];

/* ── Helpers ── */
function resolveActiveBottom(tab: MainTab): string {
  const tarefasTabs: MainTab[] = ["tarefas", "agenda_gestao", "pauta_pessoas", "cronograma"];
  if (tarefasTabs.includes(tab)) return "tarefas";
  if (tab === "clientes") return "clientes";
  const dashTabs: MainTab[] = ["visao_do_dia", "magic2", "desempenho", "visao_geral_projetos"];
  if (dashTabs.includes(tab)) return "dashboard";
  if (tab === "meu_painel") return "home";
  // Comercial, Financeiro, Ajuda and Configurações are inside "Mais"
  // (Fluxos is opened from Configurações, so it belongs to the same slot)
  if (tab === "comercial" || tab === "ajuda" || tab === "configuracoes" || tab === "fluxos" || FIN_TABS.includes(tab)) return "mais";
  return "";
}

interface Props {
  tab: MainTab;
  onTabChange: (t: MainTab) => void;
  isAdmin?: boolean;
  // Mesma exceção do UauSidebarShell: Financeiro/Comercial seguem a tela de Permissões em
  // vez de isAdmin fixo, quando informados.
  canSeeFinanceiro?: boolean;
  canSeeComercial?: boolean;
}

export function MobileBottomNav({ tab, onTabChange, isAdmin, canSeeFinanceiro, canSeeComercial }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const magicLabel = useAppSettings().data?.magic_number_label ?? "Magic Number";

  const activeKey = moreOpen ? "mais" : resolveActiveBottom(tab);
  const showFinanceiro = canSeeFinanceiro ?? isAdmin;
  const showComercial = canSeeComercial ?? isAdmin;

  const handleBottomTap = (item: typeof BOTTOM_TABS[0]) => {
    if (item.key === "mais") {
      setExpandedGroup(null);
      setMoreOpen(true);
      return;
    }
    if (SUB_TABS[item.key]) {
      if (expandedGroup === item.key) {
        setExpandedGroup(null);
      } else {
        setExpandedGroup(item.key);
        if (item.tab) onTabChange(item.tab);
      }
      return;
    }
    setExpandedGroup(null);
    if (item.tab) onTabChange(item.tab);
  };

  const goFromMore = (key: MainTab) => {
    setMoreOpen(false);
    setExpandedGroup(null);
    onTabChange(key);
  };

  // The finance pages keep their sub-bar while you are inside them, even though they are opened from "Mais"
  const subBarGroup = expandedGroup ?? (FIN_TABS.includes(tab) && showFinanceiro ? "financeiro" : null);
  const currentSubTabs = (subBarGroup ? (SUB_TABS[subBarGroup] || []) : [])
    .map((sub) => (sub.key === "magic2" ? { ...sub, label: magicLabel } : sub));

  const moreItems: { key: MainTab; label: string; hint?: string; icon: React.ComponentType<any>; show: boolean }[] = [
    { key: "comercial", label: "Comercial", icon: Briefcase, show: !!showComercial },
    { key: "financeiro", label: "Financeiro", icon: DollarSign, show: !!showFinanceiro },
    { key: "ajuda", label: "Ajuda", icon: CircleHelp, show: true },
    { key: "configuracoes", label: "Configurações", icon: Settings, show: !!isAdmin },
  ];

  return (
    <>
      {/* ── Sub-tab bar (above main pill) ── */}
      {currentSubTabs.length > 0 && (
        <div
          className="fixed inset-x-0 z-[79] flex justify-center pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
        >
          <div
            className="pointer-events-auto mx-4 flex max-w-[calc(100%-2rem)] items-center gap-1.5 overflow-x-auto rounded-full px-2 py-1.5 shadow-lg backdrop-blur-md dark:border dark:border-white/10 no-scrollbar"
            style={{ background: "var(--mobilenav-subbar-background)" }}
          >
            {currentSubTabs.map((sub) => {
              const isActive = tab === sub.key;
              return (
                <button
                  key={sub.key}
                  onClick={() => onTabChange(sub.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-white/25 text-white dark:bg-button-sheen dark:shadow-glow"
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
          className="pointer-events-auto mx-4 flex h-16 w-[calc(100%-2rem)] items-center justify-around rounded-full px-2 shadow-2xl backdrop-blur-xl dark:border dark:border-white/10"
          style={{ background: "var(--mobilenav-background)" }}
        >
          {BOTTOM_TABS.map((item) => {
            const active = activeKey === item.key;
            const isExpanded = expandedGroup === item.key;

            return (
              <button
                key={item.key}
                onClick={() => handleBottomTap(item)}
                className={cn(
                  "flex min-w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-full px-2.5 py-1.5 transition-all",
                  active || isExpanded
                    ? "bg-white/20 text-white scale-105 dark:bg-button-sheen dark:shadow-glow"
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

      {/* ── "Mais": everything that is not in the bar ── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-28 pt-5" hideCloseButton>
          <SheetHeader className="mb-3 text-left">
            <SheetTitle className="text-base">Mais</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1.5">
            {moreItems.filter((i) => i.show).map((item) => {
              const active = resolveActiveBottom(tab) === "mais" && (item.key === tab || (item.key === "financeiro" && FIN_TABS.includes(tab)) || (item.key === "configuracoes" && tab === "fluxos"));
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => goFromMore(item.key)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors",
                    active ? "bg-primary/10 text-foreground" : "hover:bg-accent/40"
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60">
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
