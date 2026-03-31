import { CheckSquare2, Square, Trash2 } from "lucide-react";

import { UserAvatar } from "@/components/avatar/UserAvatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { StageKey } from "@/lib/uau";

/** Abreviações curtas para pills da agenda */
const STAGE_SHORT: Record<StageKey, string> = {
  planejamento: "PLAN",
  captacao: "CAP",
  edicao_videos: "VDO",
  design: "DSG",
  revisao: "REV",
  pdf: "PDF",
  entrega: "ENT",
  alteracoes: "ALT",
  agendamento: "AGN",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export const STAGE_BADGE_CLASS: Record<StageKey, { bg: string; fg: string }> = {
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

interface TaskMember {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
}

const PENDING_MEMBER_NAME = "__avatar_loading__";

function getDisplayName(name: string | undefined) {
  return name && name !== PENDING_MEMBER_NAME ? name : "";
}

export function AgendaWeekTaskItem({
  stageLabel,
  stage,
  done,
  assigneeName,
  assigneeAvatarUrl,
  members,
  clientName,
  dueTime,
  density = "default",
  stagePillWidth = "full",
  isExtraDemand,
  postType,
  canInteract,
  canDelete,
  onToggle,
  onDelete,
  onClick,
}: {
  stageLabel: string;
  stage: StageKey;
  done: boolean;
  /** Primary assignee name (fallback when no members) */
  assigneeName: string;
  assigneeAvatarUrl?: string;
  /** Multiple members (optional - for tasks with multiple assignees) */
  members?: TaskMember[];
  clientName: string;
  dueTime?: string;
  density?: "default" | "compact";
  stagePillWidth?: "full" | "fit";
  /** Whether this is an extra demand task */
  isExtraDemand?: boolean;
  /** Post type origin for revisão tasks */
  postType?: string | null;
  canInteract: boolean;
  canDelete: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onClick?: () => void;
}) {
  const stageTone = STAGE_BADGE_CLASS[stage];
  const isCompact = density === "compact";
  const isAssigneeLoading = assigneeName === PENDING_MEMBER_NAME;

  // For revisão or alteração tasks with a post_type origin, show gradient badge
  const isRevisaoWithOrigin = stage === "revisao" && !!postType;
  const isAlteracaoWithOrigin = stage === "alteracoes" && !!postType;
  const hasGradientPill = isRevisaoWithOrigin || isAlteracaoWithOrigin;
  const gradientShort = isAlteracaoWithOrigin
    ? (postType === "video" ? "ALT/VDO" : "ALT/DSG")
    : (postType === "video" ? "REV/VDO" : "REV/DSG");
  const gradientClass = isAlteracaoWithOrigin
    ? (postType === "video"
      ? "bg-gradient-to-r from-stage-alteracoes to-stage-edicao_videos text-white"
      : "bg-gradient-to-r from-stage-alteracoes to-stage-design text-white")
    : (postType === "video"
      ? "bg-gradient-to-r from-pink-400 to-stage-edicao_videos text-white"
      : "bg-gradient-to-r from-pink-400 to-stage-design text-white");

  return (
    <div
      className={cn(
        "rounded-lg border shadow-sm",
        isAlteracaoWithOrigin ? "border-[#f5b800]/40" : "bg-card/20 border-border/60",
        isCompact ? "p-2" : "p-2.5",
        !canInteract && "opacity-60",
        onClick && "cursor-pointer hover:border-primary/50 hover:bg-card/40 transition-colors",
      )}
      style={isAlteracaoWithOrigin ? { background: 'linear-gradient(135deg, #FED404 0%, #FF9A02 100%)' } : undefined}
      onClick={(e) => {
        // Evita abrir edição se clicar nos botões
        if ((e.target as HTMLElement).closest("button")) return;
        onClick?.();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            // flex-1 + min-w-0 evita empurrar os botões para fora no grid do mês
            "min-w-0 flex-1",
          )}
        >
          <div
            className={cn(
              "inline-flex items-start rounded-full font-semibold",
              isCompact ? "px-2 py-1 text-[10px] leading-snug" : "px-2.5 py-1 text-xs leading-snug",
              stagePillWidth === "fit" ? "w-auto" : "w-full",
              hasGradientPill ? gradientClass : cn(stageTone.bg, stageTone.fg),
            )}
            title={stageLabel}
          >
            <span className="whitespace-nowrap">{hasGradientPill ? gradientShort : (STAGE_SHORT[stage] ?? stageLabel)}</span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            className={cn(
              "grid place-items-center rounded-md border border-border/60 bg-background/70 text-foreground transition hover:bg-accent disabled:opacity-60",
              isCompact ? "h-6 w-6" : "h-7 w-7",
            )}
            onClick={onToggle}
            disabled={!canInteract}
            aria-label={done ? "Marcar como pendente" : "Marcar como concluída"}
          >
            {done ? (
              <CheckSquare2 className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4", "text-success")} />
            ) : (
              <Square className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4", "text-muted-foreground")} />
            )}
          </button>

          {canDelete ? (
            <button
              type="button"
              className={cn(
                "grid place-items-center rounded-md border border-border/60 bg-background/70 text-foreground transition hover:bg-accent",
                isCompact ? "h-6 w-6" : "h-7 w-7",
              )}
              onClick={onDelete}
              aria-label="Remover tarefa"
              title="Remover"
            >
              <Trash2 className={cn(isCompact ? "h-3.5 w-3.5" : "h-4 w-4", "text-muted-foreground")} />
            </button>
          ) : null}
        </div>
      </div>

      <div className={cn("flex items-start gap-2", isCompact ? "mt-2" : "mt-2.5")}>
        {/* Multiple members or single assignee */}
        {members && members.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col -space-y-1.5 shrink-0">
                {members.slice(0, 2).map((m) => (
                   <UserAvatar key={m.user_id} avatarUrl={m.avatar_url} name={getDisplayName(m.display_name)} loading={m.display_name === PENDING_MEMBER_NAME} className={cn(isCompact ? "h-5 w-5" : "h-6 w-6", "border-2 border-background")} fallbackClassName="text-[10px]" />
                ))}
                {members.length > 2 && (
                  <div className={cn(
                    isCompact ? "h-5 w-5" : "h-6 w-6",
                    "flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground text-[9px] font-semibold"
                  )}>
                    +{members.length - 2}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <div className="space-y-1">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2">
                    <UserAvatar avatarUrl={m.avatar_url} name={getDisplayName(m.display_name)} loading={m.display_name === PENDING_MEMBER_NAME} className="h-5 w-5" fallbackClassName="text-[8px]" />
                    <span className="text-xs">{m.display_name}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <UserAvatar avatarUrl={assigneeAvatarUrl} name={getDisplayName(assigneeName)} loading={isAssigneeLoading} className={cn(isCompact ? "h-5 w-5" : "h-6 w-6")} fallbackClassName="text-[10px]" />
        )}
        
        <div className="min-w-0 flex-1">
          {/* Show name only for single member or no-member tasks */}
          {members && members.length > 1 ? null : (
            <p
              className={cn(
                "truncate font-semibold",
                isCompact ? "text-[12px] leading-4" : "text-sm leading-5",
              )}
              title={members && members.length === 1 ? members[0].display_name : assigneeName}
            >
              {members && members.length === 1
                ? getDisplayName(members[0].display_name).split(" ")[0] || "—"
                : (getDisplayName(assigneeName) ? getDisplayName(assigneeName).split(" ")[0] : "—")}
            </p>
          )}
          <p
            className={cn(
              "mt-1 whitespace-normal break-words text-muted-foreground",
              isCompact ? "text-[12px] leading-4" : "text-sm leading-5",
            )}
          >
            {clientName || "—"}
          </p>
          {dueTime && (
            <p
              className={cn(
                "mt-1 font-medium text-primary",
                isCompact ? "text-[10px]" : "text-xs",
              )}
            >
              ⏰ {dueTime}
            </p>
          )}
          {isExtraDemand && (
            <span
              className={cn(
                "mt-1 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400",
                isCompact ? "text-[9px]" : "text-[10px]",
              )}
            >
              ★ Extra
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
