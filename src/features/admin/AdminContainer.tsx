import { useEffect, useState } from "react";
import { Users, Building2, SprayCan, Trophy, Palette, CalendarPlus, Workflow, ChevronRight, ArrowLeft, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPanel } from "./AdminPanel";
import { AdminClientesPanel } from "./AdminClientesPanel";
import { AdminLimpezaPanel } from "./AdminLimpezaPanel";
import { AdminPontuacaoPanel } from "./AdminPontuacaoPanel";
import { AdminAgenciaPanel } from "./AdminAgenciaPanel";
import { AdminAparenciaPanel } from "./AdminAparenciaPanel";
import { AdminDatasInternasPanel } from "./AdminDatasInternasPanel";
import { AdminWhatsAppPanel } from "./AdminWhatsAppPanel";
import { AdminCargosPanel } from "./AdminCargosPanel";

export type AdminSubTab = "usuarios" | "clientes" | "limpeza" | "pontuacao" | "aparencia" | "datas" | "whatsapp" | "cargos";

type CardDef = {
  key: AdminSubTab | "fluxos";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
};

const CARDS: CardDef[] = [
  { key: "usuarios", title: "Usuários", description: "Gerencie os usuários do sistema, papéis de acesso e permissões da equipe.", icon: Users },
  { key: "cargos", title: "Cargos", description: "Crie, renomeie, reordene ou desative os cargos da equipe, e escolha quais papéis e cargos acessam cada aba/ação.", icon: Briefcase },
  { key: "clientes", title: "Clientes", description: "Cadastre e edite os clientes ativos, expirados e encerrados da operação.", icon: Building2 },
  { key: "datas", title: "Datas internas", description: "Configure feriados, datas comemorativas e eventos internos do calendário.", icon: CalendarPlus },
  { key: "limpeza", title: "Limpeza", description: "Defina as tarefas recorrentes de limpeza, horários e responsáveis.", icon: SprayCan },
  { key: "pontuacao", title: "Pontuação", description: "Ajuste regras de pontos, pesos por etapa e penalidades de desempenho.", icon: Trophy },
  { key: "aparencia", title: "Agência", description: "Marca, cores, logos, ícone do app e integrações (Google Drive) — o jeito da sua agência no Fluxo.", icon: Palette },
  { key: "fluxos", title: "Fluxos", description: "Configure os fluxos operacionais, etapas e responsáveis por papel.", icon: Workflow, external: true },
];

export function AdminContainer({
  onNavigate,
  initialSubTab = null,
  onSubTabChange,
  initialClienteId,
  onClienteIdChange,
}: {
  onNavigate?: (tab: string) => void;
  // Controlado pela URL (Index.tsx) quando disponível — cai no estado interno
  // de sempre (sem os dois props abaixo) para quem ainda chama <AdminContainer />
  // sem se importar com subaba (ex.: a aba "fin_clientes").
  initialSubTab?: AdminSubTab | null;
  onSubTabChange?: (subTab: AdminSubTab | null) => void;
  initialClienteId?: string;
  onClienteIdChange?: (clienteId: string | null) => void;
} = {}) {
  const [subTab, setSubTabState] = useState<AdminSubTab | null>(initialSubTab);

  // Mantém em sincronia quando o valor vem de fora (voltar do navegador, link direto).
  useEffect(() => {
    setSubTabState(initialSubTab ?? null);
  }, [initialSubTab]);

  const setSubTab = (next: AdminSubTab | null) => {
    setSubTabState(next);
    onSubTabChange?.(next);
  };

  const activeCard = subTab ? CARDS.find((c) => c.key === subTab) : null;

  return (
    <div className="space-y-6">
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between opacity-0"
        style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}
      >
        <div className="flex items-center gap-3">
          {subTab && (
            <Button variant="ghost" size="icon" onClick={() => setSubTab(null)} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {activeCard ? activeCard.title : "Administração"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeCard ? activeCard.description : "Gerencie usuários e clientes do sistema."}
            </p>
          </div>
        </div>
      </div>

      {!subTab ? (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 opacity-0"
          style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.1s" }}
        >
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  if (card.external && card.key === "fluxos") {
                    onNavigate?.("fluxos");
                  } else {
                    setSubTab(card.key as AdminSubTab);
                  }
                }}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-foreground">{card.title}</div>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{card.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="opacity-0" style={{ animation: "fadeUp 0.4s ease-out forwards" }}>
          {subTab === "usuarios" && <AdminPanel />}
          {subTab === "cargos" && <AdminCargosPanel />}
          {subTab === "clientes" && (
            <AdminClientesPanel
              initialClientId={initialClienteId}
              onClientDialogChange={(id) => onClienteIdChange?.(id)}
            />
          )}
          {subTab === "datas" && <AdminDatasInternasPanel />}
          {subTab === "limpeza" && <AdminLimpezaPanel />}
          {subTab === "pontuacao" && <AdminPontuacaoPanel />}
          {subTab === "aparencia" && <AdminAgenciaPanel />}
          {subTab === "whatsapp" && <AdminWhatsAppPanel />}
        </div>
      )}
    </div>
  );
}
