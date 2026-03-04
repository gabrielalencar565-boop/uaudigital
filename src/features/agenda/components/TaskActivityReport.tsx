import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, ArrowRightLeft, CheckCircle2, XCircle, Loader2, Trash2, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useClients, useTeamMembers } from "@/features/data/queries";
import { STAGES, type StageKey } from "@/lib/uau";
import { STAGE_BADGE_CLASS } from "@/features/agenda/components/AgendaWeekTaskItem";
import { toast } from "sonner";

type ActivityLog = {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

type TaskInfo = {
  id: string;
  client_id: string;
  stage: string;
  assigned_user_id: string;
  title: string | null;
};

function formatDateBR(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function formatDateOnly(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (y && m && d) return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    return dateStr;
  } catch {
    return dateStr;
  }
}

const sb = supabase as any;

export function TaskActivityReport({ onClose }: { onClose: () => void }) {
  const [filterAction, setFilterAction] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [emptyingAll, setEmptyingAll] = useState(false);
  const qc = useQueryClient();

  const clientsQ = useClients();
  const teamQ = useTeamMembers();

  const logsQ = useQuery({
    queryKey: ["task_activity_log"],
    queryFn: async (): Promise<ActivityLog[]> => {
      const { data, error } = await sb
        .from("task_activity_log")
        .select("id, task_id, user_id, action, old_value, new_value, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ActivityLog[];
    },
  });

  const taskIds = useMemo(() => {
    const ids = new Set((logsQ.data ?? []).map((l: ActivityLog) => l.task_id));
    return Array.from(ids);
  }, [logsQ.data]);

  const tasksInfoQ = useQuery({
    enabled: taskIds.length > 0,
    queryKey: ["task_activity_tasks", taskIds],
    queryFn: async (): Promise<TaskInfo[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, client_id, stage, assigned_user_id, title")
        .in("id", taskIds);
      if (error) throw error;
      return (data ?? []) as TaskInfo[];
    },
  });

  const tasksById = useMemo(() => new Map((tasksInfoQ.data ?? []).map((t) => [t.id, t])), [tasksInfoQ.data]);
  const clientsById = useMemo(() => new Map((clientsQ.data ?? []).map((c) => [c.id, c])), [clientsQ.data]);
  const teamByUserId = useMemo(() => new Map((teamQ.data ?? []).map((m) => [m.user_id, m])), [teamQ.data]);

  const filteredLogs = useMemo(() => {
    const logs = logsQ.data ?? [];
    if (filterAction === "all") return logs;
    return logs.filter((l: ActivityLog) => l.action === filterAction);
  }, [logsQ.data, filterAction]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, ActivityLog[]>();
    for (const log of filteredLogs) {
      const dateKey = format(new Date(log.created_at), "yyyy-MM-dd");
      const prev = groups.get(dateKey) ?? [];
      prev.push(log);
      groups.set(dateKey, prev);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredLogs]);

  const handleDeleteOne = async (logId: string) => {
    setDeletingId(logId);
    try {
      const { error } = await sb.from("task_activity_log").delete().eq("id", logId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["task_activity_log"] });
      toast.success("Registro excluído");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir registro");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEmptyAll = async () => {
    setEmptyingAll(true);
    try {
      // Delete all logs (RLS ensures only admin can)
      const { error } = await sb.from("task_activity_log").delete().gte("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["task_activity_log"] });
      toast.success("Relatório esvaziado!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao esvaziar relatório");
    } finally {
      setEmptyingAll(false);
    }
  };

  const actionIcon = (action: string) => {
    switch (action) {
      case "date_changed":
        return <ArrowRightLeft className="h-4 w-4 text-warning" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "uncompleted":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case "date_changed":
        return "Data alterada";
      case "completed":
        return "Concluída";
      case "uncompleted":
        return "Desmarcada";
      default:
        return action;
    }
  };

  const totalLogs = logsQ.data?.length ?? 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatório de Atividades
            </CardTitle>
            <CardDescription>
              {filteredLogs.length} registro{filteredLogs.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {totalLogs > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={emptyingAll}>
                    {emptyingAll ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Esvaziar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Esvaziar relatório?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação excluirá permanentemente <strong>{totalLogs} registro{totalLogs !== 1 ? "s" : ""}</strong> de atividade.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleEmptyAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Esvaziar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="date_changed">Datas alteradas</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
                <SelectItem value="uncompleted">Desmarcadas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        {logsQ.isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum registro encontrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {groupedByDate.map(([dateKey, logs]) => {
                const dateLabel = format(new Date(`${dateKey}T00:00:00`), "dd/MM/yyyy (EEEE)", { locale: ptBR });
                return (
                  <div key={dateKey}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-card py-1 z-10">
                      📅 {dateLabel}
                    </h3>
                    <div className="space-y-2">
                      {logs.map((log) => {
                        const task = tasksById.get(log.task_id);
                        const client = task ? clientsById.get(task.client_id) : null;
                        const member = teamByUserId.get(log.user_id);
                        const stageKey = task?.stage as StageKey | undefined;
                        const stageInfo = stageKey ? STAGES.find((s) => s.key === stageKey) : null;
                        const stageTone = stageKey ? STAGE_BADGE_CLASS[stageKey] : null;
                        const timeStr = format(new Date(log.created_at), "HH:mm", { locale: ptBR });

                        return (
                          <div
                            key={log.id}
                            className={cn(
                              "flex items-start gap-3 rounded-lg border border-border bg-card p-3",
                              "hover:bg-accent/50 transition-colors",
                            )}
                          >
                            <div className="shrink-0 mt-0.5">{actionIcon(log.action)}</div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">
                                  {actionLabel(log.action)}
                                </span>
                                {stageTone && stageInfo && (
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                      stageTone.bg,
                                      stageTone.fg,
                                    )}
                                  >
                                    {stageInfo.label}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {timeStr}
                                </span>
                              </div>

                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {client?.name ?? "Cliente removido"}{" "}
                                {task?.title ? `• ${task.title}` : ""}
                              </p>

                              <p className="text-xs text-muted-foreground/70 mt-0.5">
                                Por: {member?.display_name ?? "Usuário desconhecido"}
                              </p>

                              {log.action === "date_changed" && log.old_value && log.new_value && (
                                <p className="text-xs mt-1">
                                  <span className="text-destructive line-through">
                                    {formatDateOnly(log.old_value)}
                                  </span>
                                  {" → "}
                                  <span className="text-success font-medium">
                                    {formatDateOnly(log.new_value)}
                                  </span>
                                </p>
                              )}

                              {log.action === "completed" && log.new_value && (
                                <p className="text-xs mt-1 text-success">
                                  ✅ {formatDateBR(log.new_value)}
                                </p>
                              )}
                            </div>

                            {/* Delete individual log */}
                            <button
                              type="button"
                              className="shrink-0 grid place-items-center rounded-md border border-border/60 bg-background/70 text-muted-foreground transition hover:bg-accent hover:text-destructive h-7 w-7"
                              onClick={() => handleDeleteOne(log.id)}
                              disabled={deletingId === log.id}
                              title="Excluir registro"
                            >
                              {deletingId === log.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
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
