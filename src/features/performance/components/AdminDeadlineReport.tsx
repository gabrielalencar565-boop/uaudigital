import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TaskAssigneeRow } from "@/features/data/task-assignees-queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { TeamMemberRow } from "@/features/data/queries";
import { STAGES, type StageKey } from "@/lib/uau";

type TaskForReport = {
  id: string;
  title: string | null;
  due_date: string;
  status: "pendente" | "em_andamento" | "concluido";
  completed_at: string | null;
  assigned_user_id: string;
  client_id: string;
  stage: StageKey;
  client?: { name: string } | null;
};

type OverrideRow = {
  task_id: string;
  override_points: number;
  reason: string | null;
};

function yyyymm(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getLastDayOfMonth(year: number, month: number) {
  // Cria uma data no dia 0 do próximo mês, que é o último dia do mês atual
  return new Date(year, month, 0).getDate();
}

const NON_SCORING_STAGES: StageKey[] = ["pdf", "alteracoes", "agendamento"];

function isOnTime(task: TaskForReport) {
  if (task.status !== "concluido" || !task.completed_at) return null;
  // compara por dia
  return new Date(task.completed_at).toISOString().slice(0, 10) <= task.due_date;
}

function basePoints(task: TaskForReport) {
  if (NON_SCORING_STAGES.includes(task.stage as StageKey)) return 0;
  const onTime = isOnTime(task);
  if (onTime === null) return 0;
  return onTime ? 1 : -1;
}

export function AdminDeadlineReport({
  year,
  month,
  team,
  currentUserId,
}: {
  year: number;
  month: number;
  team: TeamMemberRow[];
  currentUserId: string;
}) {
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>(team[0]?.user_id ?? "");

  const tasksQ = useQuery({
    queryKey: ["deadline_report_tasks", year, month],
    queryFn: async (): Promise<TaskForReport[]> => {
      const start = `${yyyymm(year, month)}-01`;
      const lastDay = getLastDayOfMonth(year, month);
      const end = `${yyyymm(year, month)}-${String(lastDay).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,due_date,status,completed_at,assigned_user_id,client_id,stage,client:clients(name)")
        .is("deleted_at", null)
        .gte("due_date", start)
        .lte("due_date", end)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const assigneesQ = useQuery({
    enabled: (tasksQ.data?.length ?? 0) > 0,
    queryKey: ["deadline_report_assignees", year, month],
    queryFn: async (): Promise<TaskAssigneeRow[]> => {
      const ids = (tasksQ.data ?? []).map((t) => t.id);
      const { data, error } = await supabase
        .from("task_assignees")
        .select("id, task_id, user_id, added_by, created_at")
        .in("task_id", ids);
      if (error) throw error;
      return (data ?? []) as TaskAssigneeRow[];
    },
  });

  // Map task_id -> list of user_ids assigned
  const assigneesByTask = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assigneesQ.data ?? []) {
      const list = map.get(a.task_id) ?? [];
      list.push(a.user_id);
      map.set(a.task_id, list);
    }
    return map;
  }, [assigneesQ.data]);

  // Returns all user_ids associated with a task (assignees if any, else assigned_user_id)
  function getTaskUserIds(task: TaskForReport): string[] {
    const assignees = assigneesByTask.get(task.id);
    if (assignees && assignees.length > 0) return assignees;
    return [task.assigned_user_id];
  }

  const overridesQ = useQuery({
    enabled: (tasksQ.data?.length ?? 0) > 0,
    queryKey: ["deadline_report_overrides", year, month],
    queryFn: async (): Promise<OverrideRow[]> => {
      const ids = (tasksQ.data ?? []).map((t) => t.id);
      const { data, error } = await supabase
        .from("task_deadline_overrides")
        .select("task_id,override_points,reason")
        .in("task_id", ids);
      if (error) throw error;
      return (data ?? []) as OverrideRow[];
    },
  });

  const overrideByTaskId = useMemo(
    () => new Map((overridesQ.data ?? []).map((o) => [o.task_id, o])),
    [overridesQ.data],
  );

  const teamById = useMemo(() => new Map(team.map((m) => [m.user_id, m])), [team]);

  const summary = useMemo(() => {
    const base = team.map((m) => ({
      user_id: m.user_id,
      name: m.display_name,
      onTime: 0,
      late: 0,
      total: 0,
    }));
    const byUser = new Map(base.map((b) => [b.user_id, b]));

    for (const t of tasksQ.data ?? []) {
      if (t.status !== "concluido") continue;
      if (NON_SCORING_STAGES.includes(t.stage as StageKey)) continue;

      const userIds = getTaskUserIds(t);
      const override = overrideByTaskId.get(t.id);
      const pts = override ? override.override_points : basePoints(t);
      const onTime = isOnTime(t);

      for (const uid of userIds) {
        const s = byUser.get(uid);
        if (!s) continue;
        if (onTime === true) s.onTime += 1;
        if (onTime === false) s.late += 1;
        s.total += pts;
      }
    }

    return Array.from(byUser.values()).sort((a, b) => b.total - a.total);
  }, [team, tasksQ.data, overrideByTaskId, assigneesByTask]);

  const userTasks = useMemo(() => {
    return (tasksQ.data ?? []).filter((t) => {
      if (t.status !== "concluido") return false;
      const userIds = getTaskUserIds(t);
      return userIds.includes(selectedUserId);
    });
  }, [tasksQ.data, selectedUserId, assigneesByTask]);

  const setOverrideMut = useMutation({
    mutationFn: async (input: { taskId: string; value: "auto" | "1" | "0" | "-1" }) => {
      if (input.value === "auto") {
        const { error } = await supabase.from("task_deadline_overrides").delete().eq("task_id", input.taskId);
        if (error) throw error;
      } else {
        const override_points = Number(input.value);
        if (![1, 0, -1].includes(override_points)) throw new Error("Valor inválido");

        const { error } = await supabase
          .from("task_deadline_overrides")
          .upsert(
            {
              task_id: input.taskId,
              override_points,
              created_by: currentUserId,
            },
            { onConflict: "task_id" },
          );
        if (error) throw error;
      }

      // Recompute metas_prazos for all assigned users
      const task = (tasksQ.data ?? []).find((t) => t.id === input.taskId);
      if (task) {
        const userIds = getTaskUserIds(task);
        await Promise.all(
          userIds.map((uid) =>
            supabase.rpc("recompute_metas_prazos", {
              _user_id: uid,
              _year: year,
              _month: month,
            }),
          ),
        );
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["deadline_report_overrides", year, month] }),
        qc.invalidateQueries({ queryKey: ["performance_scores"] }),
      ]);
      toast.success("Exceção salva");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Relatório — Entregas no prazo x atrasadas</CardTitle>
            <CardDescription>
              Mês do prazo • Admin pode marcar exceções por tarefa (+1 / 0 / -1) para ajustar Metas/Prazos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-center">No prazo</TableHead>
                  <TableHead className="text-center">Atrasadas</TableHead>
                  <TableHead className="text-center">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-center tabular-nums">{s.onTime}</TableCell>
                    <TableCell className="text-center tabular-nums">{s.late}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="tabular-nums">
                        {s.total}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {summary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Sem tarefas concluídas neste mês.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por colaborador</CardTitle>
            <CardDescription>Escolha alguém e marque exceções apenas quando precisar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {team.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const first = team[0]?.user_id ?? "";
                  setSelectedUserId(first);
                }}
              >
                Reset
              </Button>
            </div>

            <div className="rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Tarefa</TableHead>
                     <TableHead className="text-center">Etapa</TableHead>
                     <TableHead className="text-center">Prazo</TableHead>
                     <TableHead className="text-center">Concluiu</TableHead>
                     <TableHead className="text-center">Auto</TableHead>
                     <TableHead className="text-center">Exceção</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userTasks.map((t) => {
                    const auto = basePoints(t);
                    const override = overrideByTaskId.get(t.id);
                    const current = override ? String(override.override_points) : "auto";

                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{t.title ?? (t.client?.name ? `Cliente: ${t.client.name}` : "Tarefa")}</p>
                            <p className="truncate text-xs text-muted-foreground">{teamById.get(t.assigned_user_id)?.role_title}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {STAGES.find((s) => s.key === t.stage)?.label ?? t.stage}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{t.due_date}</TableCell>
                        <TableCell className="text-center tabular-nums">{t.completed_at ? t.completed_at.slice(0, 10) : "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={auto >= 0 ? "secondary" : "destructive"} className="tabular-nums">
                            {auto}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Select
                            value={current}
                            onValueChange={(v) => setOverrideMut.mutate({ taskId: t.id, value: v as any })}
                          >
                            <SelectTrigger className="mx-auto w-[140px]">
                              <SelectValue placeholder="Auto" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="1">Forçar +1</SelectItem>
                              <SelectItem value="0">Forçar 0</SelectItem>
                              <SelectItem value="-1">Forçar -1</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {userTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma tarefa concluída para este colaborador no mês.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
