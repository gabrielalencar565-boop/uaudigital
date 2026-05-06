import { useState, useEffect, useCallback } from "react";
import { Check, RotateCcw, MessageSquare, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUpdatePmTask } from "../hooks/use-pm-data";
import type { PmTask } from "../pm-types";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

type ReviewStatus = "aprovado" | "alteracao" | "pendente";

interface ReviewEntry {
  status: ReviewStatus;
  note: string;
}

type RevisionNotes = Record<string, ReviewEntry>;

interface Props {
  parentTask: PmTask;
  childTasks: PmTask[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  readOnly?: boolean;
}

export function AlteracaoReviewPanel({ parentTask, childTasks, membersMap, readOnly }: Props) {
  const updateTask = useUpdatePmTask();

  // Parse existing revision_notes from parent task
  const existing = (parentTask as any).revision_notes as RevisionNotes | null;
  const [reviews, setReviews] = useState<RevisionNotes>(() => {
    const base: RevisionNotes = {};
    for (const child of childTasks) {
      base[child.id] = existing?.[child.id] ?? { status: "pendente", note: "" };
    }
    return base;
  });

  // Sync when childTasks change
  useEffect(() => {
    setReviews(prev => {
      const next: RevisionNotes = {};
      for (const child of childTasks) {
        next[child.id] = prev[child.id] ?? existing?.[child.id] ?? { status: "pendente", note: "" };
      }
      return next;
    });
  }, [childTasks.length]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounced save
  const saveToDb = useCallback((data: RevisionNotes) => {
    updateTask.mutate({ id: parentTask.id, revision_notes: data } as any);
  }, [parentTask.id, updateTask]);

  const setStatus = (childId: string, status: ReviewStatus) => {
    if (readOnly) return;
    const updated = {
      ...reviews,
      [childId]: { ...reviews[childId], status, note: reviews[childId]?.note ?? "" },
    };
    setReviews(updated);
    saveToDb(updated);
    // Expand note input when marking as alteração
    if (status === "alteracao") {
      setExpandedId(childId);
    }
  };

  const setNote = (childId: string, note: string) => {
    if (readOnly) return;
    const updated = {
      ...reviews,
      [childId]: { ...reviews[childId], note },
    };
    setReviews(updated);
  };

  const saveNote = (childId: string) => {
    saveToDb(reviews);
  };

  const approvedCount = Object.values(reviews).filter(r => r.status === "aprovado").length;
  const alteracaoCount = Object.values(reviews).filter(r => r.status === "alteracao").length;
  const pendingCount = Object.values(reviews).filter(r => r.status === "pendente").length;
  const total = childTasks.length;

  if (total === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold">Revisão de Alterações</h3>
        </div>
        <div className="flex items-center gap-2">
          {approvedCount > 0 && (
            <Badge className="bg-emerald-500/15 text-emerald-500 border-0 text-[10px] gap-1">
              <Check className="h-3 w-3" /> {approvedCount}
            </Badge>
          )}
          {alteracaoCount > 0 && (
            <Badge className="bg-amber-500/15 text-amber-500 border-0 text-[10px] gap-1">
              <RotateCcw className="h-3 w-3" /> {alteracaoCount}
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted flex">
        {approvedCount > 0 && (
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(approvedCount / total) * 100}%` }} />
        )}
        {alteracaoCount > 0 && (
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${(alteracaoCount / total) * 100}%` }} />
        )}
      </div>

      {/* Subtask review items */}
      <div className="space-y-1 rounded-lg border border-border/30 overflow-hidden">
        {childTasks.map((child) => {
          const review = reviews[child.id] ?? { status: "pendente", note: "" };
          const isExpanded = expandedId === child.id;
          const assignee = child.assignee_id ? membersMap[child.assignee_id] : null;

          return (
            <div key={child.id} className={cn(
              "border-b border-border/10 last:border-b-0 transition-colors",
              review.status === "aprovado" && "bg-emerald-500/5",
              review.status === "alteracao" && "bg-amber-500/5",
            )}>
              {/* Row */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                {/* Status buttons */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    disabled={readOnly}
                    onClick={() => setStatus(child.id, review.status === "aprovado" ? "pendente" : "aprovado")}
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center transition-all border-2",
                      review.status === "aprovado"
                        ? "bg-emerald-500 border-emerald-500 text-white scale-105"
                        : "border-emerald-500/30 hover:border-emerald-500/60 text-emerald-500/40 hover:text-emerald-500/70",
                      readOnly && "opacity-60 cursor-default"
                    )}
                    title="Aprovado"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={readOnly}
                    onClick={() => setStatus(child.id, review.status === "alteracao" ? "pendente" : "alteracao")}
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center transition-all border-2",
                      review.status === "alteracao"
                        ? "bg-amber-500 border-amber-500 text-white scale-105"
                        : "border-amber-500/30 hover:border-amber-500/60 text-amber-500/40 hover:text-amber-500/70",
                      readOnly && "opacity-60 cursor-default"
                    )}
                    title="Precisa de alteração"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "text-sm truncate block",
                    review.status === "aprovado" && "line-through text-muted-foreground"
                  )}>
                    {child.title}
                  </span>
                </div>

                {/* Assignee */}
                {assignee && (
                  <Avatar className="h-5 w-5 shrink-0 border border-background">
                    <AvatarImage src={assignee.avatar} />
                    <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{initials(assignee.name)}</AvatarFallback>
                  </Avatar>
                )}

                {/* Note indicator + expand toggle */}
                {review.status === "alteracao" && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : child.id)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                      review.note
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-muted text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500"
                    )}
                  >
                    <MessageSquare className="h-3 w-3" />
                    {review.note ? "Ver nota" : "Adicionar nota"}
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}

                {/* Show note preview for approved items that have one */}
                {review.status !== "alteracao" && review.note && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : child.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-muted/50 text-muted-foreground"
                  >
                    <MessageSquare className="h-3 w-3" />
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>

              {/* Expanded note */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-0">
                  <div className="relative">
                    <Textarea
                      value={review.note}
                      onChange={(e) => setNote(child.id, e.target.value)}
                      onBlur={() => saveNote(child.id)}
                      placeholder="Descreva o que precisa ser alterado..."
                      className="min-h-[60px] text-xs bg-background/50 border-border/30 resize-none"
                      readOnly={readOnly}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
