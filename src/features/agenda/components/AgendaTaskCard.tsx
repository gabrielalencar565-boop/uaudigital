import { CheckCircle2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/features/data/queries";
import type { StageKey } from "@/lib/uau";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

const STAGE_BADGE_CLASS: Record<StageKey, { bg: string; fg: string }> = {
  planejamento: { bg: "bg-stage-planejamento", fg: "text-stage-foreground-planejamento" },
  captacao: { bg: "bg-stage-captacao", fg: "text-stage-foreground-captacao" },
  edicao_videos: { bg: "bg-stage-edicao_videos", fg: "text-stage-foreground-edicao_videos" },
  design: { bg: "bg-stage-design", fg: "text-stage-foreground-design" },
  revisao: { bg: "bg-muted", fg: "text-foreground" },
  pdf: { bg: "bg-stage-pdf", fg: "text-stage-foreground-pdf" },
  entrega: { bg: "bg-muted", fg: "text-foreground" },
  alteracoes: { bg: "bg-stage-alteracoes", fg: "text-stage-foreground-alteracoes" },
  agendamento: { bg: "bg-stage-agendamento", fg: "text-stage-foreground-agendamento" },
};

export function AgendaTaskCard({
  task,
  stageLabel,
  assigneeName,
  assigneeAvatarUrl,
  clientName,
  disabled,
  toneBorder,
  onToggle,
}: {
  task: TaskRow;
  stageLabel: string;
  assigneeName: string;
  assigneeAvatarUrl?: string;
  clientName: string;
  disabled?: boolean;
  toneBorder: string;
  onToggle: () => void;
}) {
  const stageTone = STAGE_BADGE_CLASS[task.stage];

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg border border-border/60 bg-card/20 p-3 text-left transition hover:bg-card/40",
        "border-l-4",
        toneBorder,
        disabled && "opacity-60",
      )}
      onClick={onToggle}
      disabled={disabled}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold", stageTone.bg, stageTone.fg)}>
          {stageLabel}
        </div>
        {task.status === "concluido" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : null}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={assigneeAvatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-[10px]">{initials(assigneeName || "?")}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5">{assigneeName || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{clientName || "—"}</p>
        </div>
      </div>
    </button>
  );
}
