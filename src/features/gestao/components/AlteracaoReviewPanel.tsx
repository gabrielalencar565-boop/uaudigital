import { useState, useEffect, useCallback } from "react";
import { Check, RotateCcw, MessageSquare, ChevronDown, ChevronUp, AlertTriangle, ClipboardCheck } from "lucide-react";
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
  /** "revisao" = reviewer marks items; "alteracao" = worker sees what needs fixing (read-only) */
  mode: "revisao" | "alteracao";
}

export function AlteracaoReviewPanel({ parentTask, childTasks, membersMap, readOnly, mode }: Props) {
  const updateTask = useUpdatePmTask();

  const existing = (parentTask as any).revision_notes as RevisionNotes | null;
  const [reviews, setReviews] = useState<RevisionNotes>(() => {
    const base: RevisionNotes = {};
    for (const child of childTasks) {
      base[child.id] = existing?.[child.id] ?? { status: "pendente", note: "" };
    }
    return base;
  });

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

  const saveToDb = useCallback((data: RevisionNotes, change?: { childTitle: string; newStatus: string }) => {
    updateTask.mutate({ id: parentTask.id, revision_notes: data, _revision_change: change ?? null } as any);
  }, [parentTask.id, updateTask]);

  const isEditable = mode === "revisao" && !readOnly;

  const setStatus = (childId: string, status: ReviewStatus) => {
    if (!isEditable) return;
    const childTask = childTasks.find(c => c.id === childId);
    const updated = {
      ...reviews,
      [childId]: { ...reviews[childId], status, note: reviews[childId]?.note ?? "" },
    };
    setReviews(updated);
    saveToDb(updated, { childTitle: childTask?.title ?? "", newStatus: status });
    if (status === "alteracao") {
      setExpandedId(childId);
    }
  };

  const setNote = (childId: string, note: string) => {
    if (!isEditable) return;
    setReviews(prev => ({
      ...prev,
      [childId]: { ...prev[childId], note },
    }));
  };

  const saveNote = () => {
    saveToDb(reviews);
  };

  const approvedCount = Object.values(reviews).filter(r => r.status === "aprovado").length;
  const alteracaoCount = Object.values(reviews).filter(r => r.status === "alteracao").length;
  const pendingCount = Object.values(reviews).filter(r => r.status === "pendente").length;
  const total = childTasks.length;

  if (total === 0) return null;

  // In alteração mode, only show items that need changes
  const visibleChildren = mode === "alteracao"
    ? childTasks.filter(c => reviews[c.id]?.status === "alteracao")
    : childTasks;

  // In alteracao mode with nothing to fix
  if (mode === "alteracao" && visibleChildren.length === 0 && total > 0) {
    if (approvedCount > 0) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Check className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-medium text-emerald-500">
            Todas as subtarefas aprovadas na revisão
          </span>
        </div>
      );
    }
    return null;
  }

  const isRevisao = mode === "revisao";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRevisao
            ? <ClipboardCheck className="h-4 w-4 text-pink-500" />
            : <AlertTriangle className="h-4 w-4 text-amber-500" />
          }
          <h3 className="text-sm font-bold">
            {isRevisao ? "Checklist de Revisão" : "Alterações Necessárias"}
          </h3>
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
          {isRevisao && pendingCount > 0 && (
            <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Progress — only in revisão */}
      {isRevisao && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted flex">
          {approvedCount > 0 && (
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(approvedCount / total) * 100}%` }} />
          )}
          {alteracaoCount > 0 && (
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${(alteracaoCount / total) * 100}%` }} />
          )}
        </div>
      )}

      {/* Subtask review items */}
      <div className="space-y-1 rounded-lg border border-border/30 overflow-hidden">
        {visibleChildren.map((child) => {
          const review = reviews[child.id] ?? { status: "pendente", note: "" };
          const isExpanded = expandedId === child.id;
          const assignee = child.assignee_id ? membersMap[child.assignee_id] : null;
          // In alteração mode, auto-expand items with notes
          const showExpanded = isExpanded || (mode === "alteracao" && !!review.note);

          return (
            <div key={child.id} className={cn(
              "border-b border-border/10 last:border-b-0 transition-colors",
              review.status === "aprovado" && "bg-emerald-500/5",
              review.status === "alteracao" && "bg-amber-500/5",
            )}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                {/* Status buttons — interactive in revisão, static badge in alteração */}
                {isRevisao ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      disabled={!isEditable}
                      onClick={() => setStatus(child.id, review.status === "aprovado" ? "pendente" : "aprovado")}
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center transition-all border-2",
                        review.status === "aprovado"
                          ? "bg-emerald-500 border-emerald-500 text-white scale-105"
                          : "border-emerald-500/30 hover:border-emerald-500/60 text-emerald-500/40 hover:text-emerald-500/70",
                        !isEditable && "opacity-60 cursor-default"
                      )}
                      title="Aprovado"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      disabled={!isEditable}
                      onClick={() => setStatus(child.id, review.status === "alteracao" ? "pendente" : "alteracao")}
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center transition-all border-2",
                        review.status === "alteracao"
                          ? "bg-amber-500 border-amber-500 text-white scale-105"
                          : "border-amber-500/30 hover:border-amber-500/60 text-amber-500/40 hover:text-amber-500/70",
                        !isEditable && "opacity-60 cursor-default"
                      )}
                      title="Precisa de alteração"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="h-7 w-7 rounded-full flex items-center justify-center bg-amber-500 border-2 border-amber-500 text-white shrink-0">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </div>
                )}

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

                {/* Note toggle */}
                {review.note ? (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : child.id)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                      review.status === "alteracao"
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <MessageSquare className="h-3 w-3" />
                    {mode === "alteracao" ? "Ver detalhe" : "Ver nota"}
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                ) : isRevisao && review.status === "alteracao" ? (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : child.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-muted text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500 transition-all"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Adicionar nota
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                ) : null}
              </div>

              {/* Expanded note */}
              {showExpanded && (
                <div className="px-3 pb-3 pt-0">
                  {isRevisao ? (
                    <Textarea
                      value={review.note}
                      onChange={(e) => setNote(child.id, e.target.value)}
                      onBlur={saveNote}
                      placeholder="Descreva o que precisa ser alterado..."
                      className="min-h-[60px] text-xs bg-background/50 border-border/30 resize-none"
                      readOnly={!isEditable}
                    />
                  ) : (
                    <div className="rounded-md bg-amber-500/5 border border-amber-500/15 px-3 py-2 text-xs text-foreground/80 whitespace-pre-wrap">
                      {review.note || <span className="text-muted-foreground italic">Sem detalhes adicionais</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
