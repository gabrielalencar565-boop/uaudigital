import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { usePermission } from "@/hooks/use-permission";
import { getPendingAjudaView, setPendingAjudaView, subscribePendingAjudaView } from "@/lib/pending-ajuda-view-store";
import { ChangelogSection } from "@/features/ajuda/components/ChangelogSection";
import { FaqSection } from "@/features/ajuda/components/FaqSection";
import { MyRequestsSection } from "@/features/ajuda/components/MyRequestsSection";
import { ReportedProblemsSection } from "@/features/ajuda/components/ReportedProblemsSection";

type View = "atualizacoes" | "faq" | "solicitacoes";

export function AjudaPanel() {
  const { user } = useSession();
  const { isDeveloper } = useRole(user?.id);
  // Quem gerencia FAQ/Changelog é configurável em Configurações → Permissões (developer por
  // padrão) — quem vê "Problemas reportados" (de todo mundo) em vez de "Minhas solicitações"
  // continua exclusivo de developer, não faz parte desse painel de permissões.
  const canManageFaq = usePermission("action_manage_faq");
  const canManageChangelog = usePermission("action_manage_changelog");
  const [view, setView] = useState<View>("faq");

  // Consome um pedido pendente de navegação (ex: clique numa notificação de "novo problema
  // relatado" feito antes desse painel montar) — mesmo padrão do Meu Painel.
  useEffect(() => {
    const pending = getPendingAjudaView();
    if (pending === "problemas_reportados" || pending === "minhas_solicitacoes") {
      setView("solicitacoes");
      setPendingAjudaView(null);
    }
    return subscribePendingAjudaView((value) => {
      if (value === "problemas_reportados" || value === "minhas_solicitacoes") {
        setView("solicitacoes");
        setPendingAjudaView(null);
      }
    });
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CircleHelp className="h-6 w-6 text-primary" />
          Ajuda
        </h1>
        <p className="text-sm text-muted-foreground">
          {isDeveloper
            ? "Novidades, perguntas frequentes e os problemas que a equipe relatou."
            : "Novidades, perguntas frequentes e suas solicitações."}
        </p>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="faq">Perguntas frequentes</TabsTrigger>
          <TabsTrigger value="atualizacoes">Atualizações</TabsTrigger>
          <TabsTrigger value="solicitacoes">
            {isDeveloper ? "Problemas reportados" : "Minhas solicitações"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "faq" && <FaqSection isDeveloper={canManageFaq} />}
      {view === "atualizacoes" && <ChangelogSection isDeveloper={canManageChangelog} />}
      {view === "solicitacoes" && (isDeveloper ? <ReportedProblemsSection /> : <MyRequestsSection />)}
    </div>
  );
}
