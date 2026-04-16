import { useState, useMemo } from "react";
import { Trash2, RotateCcw, Loader2, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUpdatePmTask } from "../hooks/use-pm-data";
import { tagColor, tagDisplay } from "../pm-constants";
import { toast } from "sonner";
import type { PmTask } from "../pm-types";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserAvatar } from "@/components/avatar/UserAvatar";

interface Props {
  parentTaskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membersMap: Record<string, { name: string; avatar?: string }>;
}

export function SubtaskTrashDialog({ parentTaskId, open, onOpenChange, membersMap }: Props) {
  const updateTask = useUpdatePmTask();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const sb = supabase as any;
  const deletedSubsQ = useQuery<PmTask[]>({
    queryKey: ["pm_deleted_subtasks_dialog", parentTaskId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await sb
        .from("pm_tasks")
        .select("*")
        .eq("parent_task_id", parentTaskId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleRestore = (subId: string) => {
    setRestoringId(subId);
    updateTask.mutate({ id: subId, deleted_at: null, deleted_by: null } as any, {
      onSuccess: () => {
        deletedSubsQ.refetch();
        toast.success("Subtarefa restaurada!");
        setRestoringId(null);
      },
      onError: () => setRestoringId(null),
    });
  };

  const allItems = deletedSubsQ.data ?? [];
  const items = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(s => (s.title ?? "").toLowerCase().includes(q));
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg z-[200]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Lixeira de Subtarefas
          </DialogTitle>
          <DialogDescription>
            {searchQuery.trim()
              ? `${items.length} de ${allItems.length} subtarefa${allItems.length !== 1 ? "s" : ""}`
              : `${allItems.length} subtarefa${allItems.length !== 1 ? "s" : ""} na lixeira`}
          </DialogDescription>
        </DialogHeader>

        {allItems.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar subtarefas..."
              className="pl-9"
            />
          </div>
        )}

        {deletedSubsQ.isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Trash2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              {searchQuery.trim() ? "Nenhuma subtarefa encontrada" : "A lixeira está vazia"}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-2">
            <div className="space-y-3">
              {items.map(sub => {
                const deletedAt = (sub as any).deleted_at ? new Date((sub as any).deleted_at) : null;
                const deletedById = (sub as any).deleted_by;
                const deletedByMember = deletedById ? membersMap[deletedById] : null;
                const assignee = sub.assignee_id ? membersMap[sub.assignee_id] : null;
                const daysLeft = deletedAt ? 30 - differenceInDays(new Date(), deletedAt) : null;

                return (
                  <div
                    key={sub.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent/50 transition-colors"
                  >
                    <UserAvatar
                      avatarUrl={assignee?.avatar}
                      name={assignee?.name ?? "—"}
                      className="h-8 w-8 shrink-0"
                      fallbackClassName="text-xs"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{sub.title}</p>
                        {(sub.tags ?? []).map(rawTag => {
                          const tc = tagColor(rawTag);
                          const name = tagDisplay(rawTag);
                          return (
                            <Badge key={rawTag} className={cn("text-[8px] h-4 px-1 border-0", tc.bg, tc.text)}>
                              {name}
                            </Badge>
                          );
                        })}
                      </div>
                      {deletedAt && (
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-muted-foreground/70">
                              Excluída em {format(deletedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                            {daysLeft !== null && (
                              <Badge
                                variant={daysLeft <= 7 ? "destructive" : "secondary"}
                                className="text-[10px] gap-1"
                              >
                                {daysLeft > 0 ? `${daysLeft}d restantes` : "Expirando..."}
                              </Badge>
                            )}
                          </div>
                          {deletedByMember && (
                            <p className="text-xs text-muted-foreground/70">
                              Excluída por: <span className="font-medium text-muted-foreground">{deletedByMember.name}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(sub.id)}
                      disabled={restoringId === sub.id}
                      title="Restaurar subtarefa"
                    >
                      {restoringId === sub.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
