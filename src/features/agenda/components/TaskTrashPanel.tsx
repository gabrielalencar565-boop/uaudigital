import { useEffect, useState } from "react";
import { differenceInDays } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, RotateCcw, AlertTriangle, Loader2, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useDeletedTasks, useRestoreTask, usePermanentlyDeleteTask, useEmptyTrash, useClients, useTeamMembers } from "@/features/data/queries";
import { STAGES } from "@/lib/uau";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("");
}

export function TaskTrashPanel({ onClose, isAdmin = false }: { onClose: () => void; isAdmin?: boolean }) {
  const deletedTasksQ = useDeletedTasks();
  const clientsQ = useClients();
  const teamQ = useTeamMembers();
  const restoreTask = useRestoreTask();
  const permanentlyDeleteTask = usePermanentlyDeleteTask();
  const emptyTrash = useEmptyTrash();
  
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [emptyingTrash, setEmptyingTrash] = useState(false);

  const clientsById = new Map((clientsQ.data ?? []).map(c => [c.id, c]));
  const teamByUserId = new Map((teamQ.data ?? []).map(m => [m.user_id, m]));

  // Auto-delete tasks older than 30 days
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

  const handleRestore = async (taskId: string) => {
    setRestoringId(taskId);
    try {
      await restoreTask.mutateAsync({ taskId });
      toast.success("Tarefa restaurada com sucesso!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao restaurar tarefa");
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (taskId: string) => {
    setDeletingId(taskId);
    try {
      await permanentlyDeleteTask.mutateAsync({ taskId });
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
      toast.success("Lixeira esvaziada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao esvaziar lixeira");
    } finally {
      setEmptyingTrash(false);
    }
  };

  const deletedTasks = deletedTasksQ.data ?? [];

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
              {deletedTasks.length} tarefa{deletedTasks.length !== 1 ? "s" : ""} na lixeira
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {deletedTasks.length > 0 && isAdmin && (
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
                      Esta ação excluirá permanentemente <strong>{deletedTasks.length} tarefa{deletedTasks.length !== 1 ? "s" : ""}</strong>.
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

      <CardContent className="flex-1 overflow-hidden">
        {deletedTasksQ.isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : deletedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Trash2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">A lixeira está vazia</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {deletedTasks.map(task => {
                const client = clientsById.get(task.client_id);
                const member = teamByUserId.get(task.assigned_user_id);
                const deletedByMember = task.deleted_by ? teamByUserId.get(task.deleted_by) : null;
                const stageLabel = STAGES.find(s => s.key === task.stage)?.label ?? task.stage;
                const deletedAt = task.deleted_at ? new Date(task.deleted_at) : null;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border bg-card p-3",
                      "hover:bg-accent/50 transition-colors"
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={member?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {initials(member?.display_name ?? "?")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {member?.display_name ?? "—"}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {stageLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {client?.name ?? "Cliente removido"} • {format(new Date(`${task.due_date}T00:00:00`), "dd/MM/yyyy")}
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
                            {deletedByMember && (
                              <p className="text-xs text-muted-foreground/70">
                                Excluída por: <span className="font-medium text-muted-foreground">{deletedByMember.display_name}</span>
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
                        onClick={() => handleRestore(task.id)}
                        disabled={restoringId === task.id}
                        title="Restaurar tarefa"
                      >
                        {restoringId === task.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deletingId === task.id}
                            title="Excluir permanentemente"
                          >
                            {deletingId === task.id ? (
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
                              onClick={() => handlePermanentDelete(task.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
