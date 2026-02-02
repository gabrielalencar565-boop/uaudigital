import { differenceInCalendarDays, format } from "date-fns";

import { CheckSquare2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageKey } from "@/lib/uau";
import { STAGE_BADGE_CLASS } from "@/features/agenda/components/AgendaWeekTaskItem";

function dateOnlyToLocalDate(dateOnly: string) {
  const [y, m, d] = dateOnly.split("-").map((n) => Number(n));
  if (!y || !m || !d) return new Date(dateOnly);
  return new Date(y, m - 1, d);
}

function completedLabel(completedAt: string, today: Date) {
  const completed = new Date(completedAt);
  const daysAgo = differenceInCalendarDays(today, completed);
  if (Number.isNaN(daysAgo)) return "Concluída";
  if (daysAgo <= 0) return "Concluída hoje";
  return `Concluída • há ${daysAgo} dia${daysAgo === 1 ? "" : "s"}`;
}

function dueLabel(dueDate: string, today: Date) {
  const daysLeft = differenceInCalendarDays(dateOnlyToLocalDate(dueDate), today);
  if (daysLeft < 0) {
    const n = Math.abs(daysLeft);
    return `Atrasada • há ${n} dia${n === 1 ? "" : "s"}`;
  }
  if (daysLeft === 0) return "Vence hoje";
  if (daysLeft <= 10) return `Daqui ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`;
  return `Daqui ${daysLeft} dias`;
}

export function MeuPainelTaskCard({
  clientName,
  stageLabel,
  stage,
  title,
  dueDate,
  status,
  completedAt,
  onToggleComplete,
  isUpdating,
}: {
  clientName: string;
  stageLabel: string;
  stage: StageKey;
  title?: string | null;
  dueDate: string;
  status: "pendente" | "em_andamento" | "concluido";
  completedAt?: string | null;
  onToggleComplete: () => void;
  isUpdating: boolean;
}) {
  const today = new Date();
  const stageTone = STAGE_BADGE_CLASS[stage];
  const dueText =
    status === "concluido" ? (completedAt ? completedLabel(completedAt, today) : "Concluída") : dueLabel(dueDate, today);

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-base font-semibold leading-6">{clientName || "—"}</p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-semibold leading-snug",
            stageTone.bg,
            stageTone.fg,
          )}
        >
          {stageLabel}
        </span>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {format(dateOnlyToLocalDate(dueDate), "dd/MM")}
        </span>

        <button
          type="button"
          className={cn(
            "grid shrink-0 place-items-center rounded-md border border-border/60 bg-background/70 text-foreground transition hover:bg-accent disabled:opacity-60",
            "h-8 w-8",
          )}
          onClick={onToggleComplete}
          disabled={isUpdating}
          aria-label={status === "concluido" ? "Marcar como pendente" : "Marcar como concluída"}
          title={status === "concluido" ? "Desmarcar" : "Concluir"}
        >
          {status === "concluido" ? (
            <CheckSquare2 className={cn("h-4 w-4", "text-success")} />
          ) : (
            <Square className={cn("h-4 w-4", "text-muted-foreground")} />
          )}
        </button>
      </div>

      {title ? <p className="truncate text-sm text-muted-foreground">{title}</p> : null}

      <p className="text-xs text-muted-foreground">{dueText}</p>
    </div>
  );
}
