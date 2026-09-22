import { useMemo } from "react";
import { MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { useTeamMembers } from "@/features/data/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useAllProblemReports,
  useUpdateProblemReportStatus,
  type ProblemReportStatus,
} from "@/features/ajuda/hooks/use-help-data";

const STATUS_LABELS: Record<ProblemReportStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

const STATUS_DOT: Record<ProblemReportStatus, string> = {
  aberto: "bg-muted-foreground",
  em_andamento: "bg-amber-500",
  resolvido: "bg-success",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    ", " + new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ReportedProblemsSection() {
  const reportsQ = useAllProblemReports();
  const membersQ = useTeamMembers();
  const updateStatus = useUpdateProblemReportStatus();
  const reports = reportsQ.data ?? [];

  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string | null }> = {};
    (membersQ.data ?? []).forEach((tm: any) => {
      m[tm.user_id] = { name: tm.display_name, avatar: normalizeAvatarUrl(tm.avatar_url) };
    });
    return m;
  }, [membersQ.data]);

  if (reportsQ.isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>;
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
        Nenhum problema relatado até agora. 🎉
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => {
        const reporter = membersMap[r.user_id];
        return (
          <div key={r.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[r.status])} />
                <span className="text-sm font-medium text-foreground">{reporter?.name ?? "Alguém"}</span>
                <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
              </div>
              <Select value={r.status} onValueChange={(v) => updateStatus.mutate({ id: r.id, status: v as ProblemReportStatus })}>
                <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as ProblemReportStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="mt-2 text-sm text-foreground">{r.description}</p>

            {r.element_info && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <code className="break-all">{r.element_info.selector}</code>
                  {r.element_info.text && <p className="mt-0.5 italic">"{r.element_info.text}"</p>}
                </div>
              </div>
            )}

            {r.page_context && (
              <a href={r.page_context} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-primary hover:underline">
                {r.page_context}
              </a>
            )}

            {r.attachment_url && (
              <a href={r.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                <img src={r.attachment_url} alt="Anexo" className="h-20 w-20 rounded-lg border border-border/50 object-cover" />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
