import { cn } from "@/lib/utils";
import {
  UserRound, ClipboardList, Eye, Target, Trophy, Settings,
} from "lucide-react";
import type { MainTab } from "./UauSidebarShell";

interface MobileBottomNavProps {
  tab: MainTab;
  onTabChange: (t: MainTab) => void;
  isAdmin?: boolean;
}

const NAV_ITEMS: { key: MainTab; label: string; icon: React.ComponentType<any>; adminOnly?: boolean }[] = [
  { key: "meu_painel", label: "Painel", icon: UserRound },
  { key: "visao_geral_projetos", label: "Projetos", icon: ClipboardList },
  { key: "visao_do_dia", label: "Dia", icon: Eye },
  { key: "magic2", label: "Magic", icon: Target },
  { key: "desempenho", label: "Performance", icon: Trophy },
  { key: "configuracoes", label: "Config", icon: Settings, adminOnly: true },
];

// Group tabs to their bottom nav equivalent
const TAB_TO_NAV: Record<string, MainTab> = {
  meu_painel: "meu_painel",
  visao_geral_projetos: "visao_geral_projetos",
  tarefas: "visao_geral_projetos",
  agenda_gestao: "visao_geral_projetos",
  cronograma: "visao_geral_projetos",
  fluxos: "visao_geral_projetos",
  visao_do_dia: "visao_do_dia",
  magic2: "magic2",
  desempenho: "desempenho",
  financeiro: "configuracoes",
  metas: "configuracoes",
  configuracoes: "configuracoes",
};

export function MobileBottomNav({ tab, onTabChange, isAdmin }: MobileBottomNavProps) {
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);
  const activeNav = TAB_TO_NAV[tab] ?? "meu_painel";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-lg safe-area-bottom">
      <div className="flex items-stretch justify-around px-1">
        {items.map((item) => {
          const active = activeNav === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 px-1 transition-all duration-200 relative",
                active
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-primary" />
              )}
              <div
                className={cn(
                  "flex items-center justify-center rounded-2xl transition-all duration-200",
                  active
                    ? "h-8 w-12 bg-primary/10"
                    : "h-8 w-8"
                )}
              >
                <item.icon className={cn("h-[18px] w-[18px] transition-all", active && "h-[20px] w-[20px]")} />
              </div>
              <span className={cn(
                "text-[10px] leading-tight transition-all",
                active ? "font-bold" : "font-medium"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
