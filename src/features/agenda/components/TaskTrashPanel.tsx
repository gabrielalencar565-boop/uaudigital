import { useEffect, useState } from "react";
import { differenceInDays } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, RotateCcw, AlertTriangle, Loader2, Clock, Kanban, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useDeletedTasks, useRestoreTask, usePermanentlyDeleteTask, useEmptyTrash, useClients, useTeamMembers } from "@/features/data/queries";
import { useDeletedPmTasks, useRestorePmTask, usePermanentlyDeletePmTask } from "@/features/gestao/hooks/use-pm-data";
import { STAGES } from "@/lib/uau";

type TrashItem = {
  id: string;
  type: "legacy" | "pm";
  title: string;
  clientName: string;
  assigneeName: string;
  assigneeAvatar?: string | null;
  stageLabel: string;
  dueDate: string | null;
  deletedAt: Date | null;
  deletedByName: string | null;
};

export function TaskTrashPanel({ onClose, isAdmin = false }: { onClose: () => void; isAdmin?: boolean }) {
  const deletedTasksQ = useDeletedTasks();
  const deletedPmTasksQ = useDeletedPmTasks();
  const clientsQ = useClients();
  const teamQ = useTeamMembers();
  const restoreTask = useRestoreTask();
  const restorePmTask = useRestorePmTask();
  const permanentlyDeleteTask = usePermanentlyDeleteTask();
  const permanentlyDeletePmTask = usePermanentlyDeletePmTask();
  const emptyTrash = useEmptyTrash();
  
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const clientsById = new Map((clientsQ.data ?? []).map(c => [c.id, c]));
  const teamByUserId = new Map((teamQ.data ?? []).map(m => [m.user_id, m]));

  // Build unified trash list
  const legacyItems: TrashItem[] = (deletedTasksQ.data ?? [])
    .filter(t => !t.description?.startsWith("pm:"))
    .map(t => {
      const client = clientsById.get(t.client_id);
      const member = teamByUserId.get(t.assigned_user_id);
      const deletedByMember = t.deleted_by ? teamByUserId.get(t.deleted_by) : null;
      return {
        id: t.id,
        type: "legacy" as const,
        title: t.title ?? member?.display_name ?? "—",
        clientName: client?.name ?? "Cliente removido",
        assigneeName: member?.display_name ?? "—",
        assigneeAvatar: member?.avatar_url,
        stageLabel: STAGES.find(s => s.key === t.stage)?.label ?? t.stage,
        dueDate: t.due_date,
        deletedAt: t.deleted_at ? new Date(t.deleted_at) : null,
        deletedByName: deletedByMember?.display_name ?? null,
      };
    });

  const pmItems: TrashItem[] = (deletedPmTasksQ.data ?? []).map(t => {
    const client = clientsById.get(t.client_id);
    const member = t.assignee_id ? teamByUserId.get(t.assignee_id) : null;
    const deletedByMember = (t as any).deleted_by ? teamByUserId.get((t as any).deleted_by) : null;
    const stageLabel = STAGES.find(s => s.key === t.stage_current)?.label ?? t.stage_current;
    return {
      id: t.id,
      type: "pm" as const,
      title: t.title,
      clientName: client?.name ?? "Cliente removido",
      assigneeName: member?.display_name ?? "—",
      assigneeAvatar: member?.avatar_url,
      stageLabel,
      dueDate: t.due_date,
      deletedAt: (t as any).deleted_at ? new Date((t as any).deleted_at) : null,
      deletedByName: deletedByMember?.display_name ?? null,
    };
  });

  const allItems = [...legacyItems, ...pmItems].sort((a, b) => {
    if (!a.deletedAt || !b.deletedAt) return 0;
    return b.deletedAt.getTime() - a.deletedAt.getTime();
  });

  const filteredItems = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(it =>
      (it.title ?? "").toLowerCase().includes(q) ||
      (it.clientName ?? "").toLowerCase().includes(q) ||
      (it.assigneeName ?? "").toLowerCase().includes(q) ||
      (it.stageLabel ?? "").toLowerCase().includes(q)
    );
  })();

  // Auto-delete legacy tasks older than 30 days
  useEffect(() => {
    const deletedTasks = deletedTasksQ.data ?? [];
    const now = new Date();
    const expiredTasks = deletedTasks.filter(t => {
      if (!t.deleted_at) return false;
      return differenceInDays(now, new Date(t.deleted_at)) >= 30;
    });
    if (expiredTasks.length === 0) return;
    
    (async () => {
      for (const t of expiredTasks) {
        try {
          await permanentlyDeleteTask.mutateAsync({ taskId: t.id });
        } catch (e) {
          console.error("Auto-delete expired task failed:", e);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletedTasksQ.data]);

  // Auto-delete PM tasks older than 30 days
  useEffect(() => {
    const deletedPm = deletedPmTasksQ.data ?? [];
    const now = new Date();
    const expired = deletedPm.filter(t => {
      const da = (t as any).deleted_at;
      if (!da) return false;
      return differenceInDays(now, new Date(da)) >= 30;
    });
    if (expired.length === 0) return;
    
    (async () => {
      for (const t of expired) {
        try {
          await permanentlyDeletePmTask.mutateAsync(t.id);
        } catch (e) {
          console.error("Auto-delete expired PM task failed:", e);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletedPmTasksQ.data]);

  const handleRestore = async (item: TrashItem) => {
    setRestoringId(item.id);
    try {
      if (item.type === "pm") {
        await restorePmTask.mutateAsync(item.id);
      } else {
        await restoreTask.mutateAsync({ taskId: item.id });
      }
      toast.success("Tarefa restaurada com sucesso!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao restaurar tarefa");
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    setDeletingId(item.id);
    try {
      if (item.type === "pm") {
        await permanentlyDeletePmTask.mutateAsync(item.id);
      } else {
        await permanentlyDeleteTask.mutateAsync({ taskId: item.id });
      }
      toast.success("Tarefa excluída permanentemente");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir tarefa");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEmptyTrash = async () => {
    setEmptyingTrash(true);
    try {
      await emptyTrash.mutateAsync();
      const pmTasks = deletedPmTasksQ.data ?? [];
      for (const t of pmTasks) {
        await permanentlyDeletePmTask.mutateAsync(t.id);
      }
      toast.success("Lixeira esvaziada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao esvaziar lixeira");
    } finally {
      setEmptyingTrash(false);
    }
  };

  const isLoading = deletedTasksQ.isLoading || deletedPmTasksQ.isLoading;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Lixeira de Tarefas
            </CardTitle>
            <CardDescription>
              {searchQuery.trim()
                ? `${filteredItems.length} de ${allItems.length} tarefa${allItems.length !== 1 ? "s" : ""}`
                : `${allItems.length} tarefa${allItems.length !== 1 ? "s" : ""} na lixeira`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {allItems.length > 0 && isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={emptyingTrash}>
                    {emptyingTrash ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Esvaziar Lixeira
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Esvaziar lixeira?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação excluirá permanentemente <strong>{allItems.length} tarefa{allItems.length !== 1 ? "s" : ""}</strong>.
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleEmptyTrash}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Esvaziar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col gap-3">
        {allItems.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por título, cliente, responsável ou etapa..."
              className="pl-9"
            />
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Trash2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">A lixeira está vazia</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {filteredItems.map(item => {
                const deletedAt = item.deletedAt;

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border bg-card p-3",
                      "hover:bg-accent/50 transition-colors"
                    )}
                  >
                    <UserAvatar avatarUrl={item.assigneeAvatar} name={item.assigneeName} className="h-8 w-8 shrink-0" fallbackClassName="text-xs" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {item.title}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {item.stageLabel}
                        </Badge>
                        {item.type === "pm" && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Kanban className="h-3 w-3" />
                            Gestão
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.clientName} • {item.dueDate ? format(new Date(`${item.dueDate}T00:00:00`), "dd/MM/yyyy") : "Sem prazo"}
                      </p>
                      {deletedAt && (() => {
                        const daysLeft = 30 - differenceInDays(new Date(), deletedAt);
                        return (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground/70">
                                Excluída em {format(deletedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                              <Badge variant={daysLeft <= 7 ? "destructive" : "secondary"} className="text-[10px] gap-1">
                                <Clock className="h-3 w-3" />
                                {daysLeft > 0 ? `${daysLeft}d restantes` : "Expirando..."}
                              </Badge>
                            </div>
                            {item.deletedByName && (
                              <p className="text-xs text-muted-foreground/70">
                                Excluída por: <span className="font-medium text-muted-foreground">{item.deletedByName}</span>
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(item)}
                        disabled={restoringId === item.id}
                        title="Restaurar tarefa"
                      >
                        {restoringId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>

                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={deletingId === item.id}
                              title="Excluir permanentemente"
                            >
                              {deletingId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta tarefa será excluída permanentemente e não poderá ser recuperada.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handlePermanentDelete(item)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
