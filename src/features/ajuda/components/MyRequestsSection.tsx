import { CircleHelp, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyProblemReports, type ProblemReportStatus } from "@/features/ajuda/hooks/use-help-data";

const STATUS_LABELS: Record<ProblemReportStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

const STATUS_CLASSES: Record<ProblemReportStatus, string> = {
  aberto: "bg-muted text-muted-foreground",
  em_andamento: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  resolvido: "bg-success/15 text-success",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    ", " + new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function MyRequestsSection() {
  const reportsQ = useMyProblemReports();
  const reports = reportsQ.data ?? [];

  if (reportsQ.isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>;
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
        Você ainda não relatou nenhum problema. Use o{" "}
        <CircleHelp className="inline h-3.5 w-3.5 -mt-0.5 text-foreground" /> no topo da tela quando encontrar algo estranho.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_CLASSES[r.status])}>
              {STATUS_LABELS[r.status]}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
          </div>
          <p className="mt-2 text-sm text-foreground">{r.description}</p>
          {r.element_info && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
              <code className="truncate">{`<${r.element_info.tag}>${r.element_info.text ? ` ${r.element_info.text.slice(0, 40)}` : ""}`}</code>
            </div>
          )}
          {r.attachment_url && (
            <a href={r.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
              <img src={r.attachment_url} alt="Anexo" className="h-16 w-16 rounded-lg border border-border/50 object-cover" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
