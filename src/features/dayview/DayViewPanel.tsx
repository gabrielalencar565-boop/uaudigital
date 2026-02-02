import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useClients, useTasks, useTeamMembers } from "@/features/data/queries";
import { useTaskAssigneesByMonth } from "@/features/data/task-assignees-queries";
import { Magic2Dashboard } from "@/features/magic2/components/Magic2Dashboard";
import { useMagic2Dashboard } from "@/features/magic2/hooks/use-magic2-dashboard";
import { STAGES } from "@/lib/uau";
import { cn } from "@/lib/utils";
import { RefreshCw, Calendar, Target, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("");
}

function statusTone(status: string, dueDate: string, todayKey: string) {
  if (status === "concluido") return "success" as const;
  if (dueDate < todayKey) return "destructive" as const;
  return "warning" as const;
}

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function DayViewPanel() {
  const [active, setActive] = useState<"magic" | "agenda">("magic");
  const [autoRotate, setAutoRotate] = useState(false);
  const now = useNow({ intervalMs: 30_000 });
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Navegador de mês/ano
  const [selectedYear, setSelectedYear] = useState(() => now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => now.getMonth() + 1);
  
  const today = now;
  const todayKey = format(today, "yyyy-MM-dd");
  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  
  const clientsQ = useClients();
  const teamQ = useTeamMembers();
  const tasksQ = useTasks({ month: monthKey });
  const magic2 = useMagic2Dashboard(selectedYear, selectedMonth);
  const assigneesQ = useTaskAssigneesByMonth(monthKey);
  
  const clientsById = useMemo(() => new Map((clientsQ.data ?? []).map(c => [c.id, c] as const)), [clientsQ.data]);
  const teamByUserId = useMemo(() => new Map((teamQ.data ?? []).map(m => [m.user_id, m] as const)), [teamQ.data]);

  // Mapa de múltiplos assignees por tarefa
  const assigneesByTaskId = useMemo(() => {
    const map = new Map<string, { user_id: string; display_name: string; avatar_url?: string | null }[]>();
    for (const a of assigneesQ.data ?? []) {
      const member = teamByUserId.get(a.user_id);
      if (!member) continue;
      const prev = map.get(a.task_id) ?? [];
      prev.push({
        user_id: a.user_id,
        display_name: member.display_name,
        avatar_url: member.avatar_url,
      });
      map.set(a.task_id, prev);
    }
    return map;
  }, [assigneesQ.data, teamByUserId]);
  
  // Se estamos visualizando o mês atual, mostrar tarefas de hoje
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;
  
  const todayTasks = useMemo(() => {
    const tasks = (tasksQ.data ?? []).filter(t => isCurrentMonth ? t.due_date === todayKey : true);
    return tasks.sort((a, b) => {
      const w = (s: string) => s === "concluido" ? 2 : s === "em_andamento" ? 1 : 0;
      const dw = w(a.status) - w(b.status);
      if (dw !== 0) return dw;
      const na = teamByUserId.get(a.assigned_user_id)?.display_name ?? "";
      const nb = teamByUserId.get(b.assigned_user_id)?.display_name ?? "";
      return na.localeCompare(nb);
    });
  }, [tasksQ.data, todayKey, teamByUserId, isCurrentMonth]);

  const overdueTasks = useMemo(() => {
    return (tasksQ.data ?? [])
      .filter(t => t.status !== "concluido" && t.due_date < todayKey)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [tasksQ.data, todayKey]);

  const completedTasks = useMemo(() => 
    (tasksQ.data ?? []).filter(t => t.status === "concluido").length
  , [tasksQ.data]);

  const totalTasks = tasksQ.data?.length ?? 0;

  // Navegação de mês
  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const goToToday = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["magic2"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["clients"] }),
      queryClient.invalidateQueries({ queryKey: ["team_members"] }),
    ]);
    setIsRefreshing(false);
    toast.success("Dados atualizados!");
  };

  // Auto-alternância a cada 10 segundos
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setActive(v => v === "magic" ? "agenda" : "magic");
    }, 10_000);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // Parar auto-rotate quando clicar manualmente
  const handleManualTabChange = (tab: "magic" | "agenda") => {
    setAutoRotate(false);
    setActive(tab);
  };

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Visão do Dia</h2>
          <p className="text-sm text-muted-foreground">
            {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Navegador de mês/ano */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={goToPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {MONTHS_PT.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isCurrentMonth && (
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoje
          </Button>
        )}
      </div>

      {/* Tabs de navegação com Auto-Rotate */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={active === "magic" ? "default" : "outline"}
          size="sm"
          onClick={() => handleManualTabChange("magic")}
        >
          <Target className="h-4 w-4 mr-2" />
          Magic Number
        </Button>
        <Button
          variant={active === "agenda" ? "default" : "outline"}
          size="sm"
          onClick={() => handleManualTabChange("agenda")}
        >
          <Calendar className="h-4 w-4 mr-2" />
          {isCurrentMonth ? "Agenda de Hoje" : "Agenda do Mês"}
        </Button>
        <Button
          variant={autoRotate ? "default" : "outline"}
          size="sm"
          onClick={() => setAutoRotate(v => !v)}
          className={cn(autoRotate && "animate-pulse")}
        >
          <RotateCcw className={cn("h-4 w-4 mr-2", autoRotate && "animate-spin")} />
          Auto {autoRotate ? "(10s)" : ""}
        </Button>
      </div>

      {/* Conteúdo */}
      {active === "magic" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ciclo: {String(selectedMonth).padStart(2, "0")}/{selectedYear}
          </p>
          {magic2.query.isLoading ? (
            <Card>
              <CardHeader>
                <CardTitle>Carregando…</CardTitle>
                <CardDescription>Buscando dados do mês selecionado.</CardDescription>
              </CardHeader>
            </Card>
          ) : magic2.cycles.length ? (
            <Magic2Dashboard dashboard={magic2.dashboard} year={selectedYear} month={selectedMonth} />
          ) : (
            <Card className="border-dashed">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted/50 grid place-items-center">
                  <Target className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">Magic Number não configurado</CardTitle>
                <CardDescription>
                  Não há ciclos ativos para {String(selectedMonth).padStart(2, "0")}/{selectedYear}.
                  <br />
                  Vá até o <strong>Magic Number</strong> para adicionar clientes ao ciclo.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {isCurrentMonth ? "Agenda de Hoje" : `Agenda de ${MONTHS_PT[selectedMonth - 1]}`}
            </CardTitle>
            <CardDescription>
              {overdueTasks.length ? `${overdueTasks.length} atrasada(s) • ` : ""}
              {completedTasks}/{totalTasks} concluída(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueTasks.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-destructive">Atrasadas</p>
                {overdueTasks.map(t => {
                  const members = assigneesByTaskId.get(t.id) ?? [];
                  const person = teamByUserId.get(t.assigned_user_id);
                  const client = clientsById.get(t.client_id);
                  const stageLabel = STAGES.find(s => s.key === t.stage)?.label ?? t.stage;
                  const daysLate = differenceInCalendarDays(today, new Date(`${t.due_date}T00:00:00`));
                  const displayMembers = members.length > 0 ? members : person ? [{ user_id: person.user_id, display_name: person.display_name, avatar_url: person.avatar_url }] : [];
                  
                  return (
                    <div key={t.id} className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 mb-2">
                      {displayMembers.length > 1 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex -space-x-2 shrink-0">
                              {displayMembers.slice(0, 3).map((m) => (
                                <Avatar key={m.user_id} className="h-8 w-8 border-2 border-background">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[10px]">{initials(m.display_name)}</AvatarFallback>
                                </Avatar>
                              ))}
                              {displayMembers.length > 3 && (
                                <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground text-xs">
                                  +{displayMembers.length - 3}
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <div className="space-y-1">
                              {displayMembers.map((m) => (
                                <div key={m.user_id} className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={m.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-[8px]">{initials(m.display_name)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs">{m.display_name}</span>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={person?.avatar_url ?? undefined} />
                          <AvatarFallback>{initials(person?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {displayMembers.length > 1 
                            ? displayMembers.map(m => m.display_name).join(", ")
                            : person?.display_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{client?.name} • {stageLabel}</p>
                      </div>
                      <Badge variant="destructive" className="text-xs">{daysLate}d</Badge>
                    </div>
                  );
                })}
              </div>
            )}

            {todayTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {isCurrentMonth ? "Nenhuma tarefa para hoje 🎉" : "Nenhuma tarefa neste mês"}
              </p>
            ) : (
              todayTasks.map(t => {
                const members = assigneesByTaskId.get(t.id) ?? [];
                const person = teamByUserId.get(t.assigned_user_id);
                const client = clientsById.get(t.client_id);
                const stageLabel = STAGES.find(s => s.key === t.stage)?.label ?? t.stage;
                const tone = statusTone(t.status, t.due_date, todayKey);
                const displayMembers = members.length > 0 ? members : person ? [{ user_id: person.user_id, display_name: person.display_name, avatar_url: person.avatar_url }] : [];
                
                return (
                  <div key={t.id} className={cn(
                    "flex items-center gap-3 rounded-lg border border-border/60 bg-card/20 px-3 py-2",
                    t.status === "concluido" && "opacity-60"
                  )}>
                    {displayMembers.length > 1 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex -space-x-2 shrink-0">
                            {displayMembers.slice(0, 3).map((m) => (
                              <Avatar key={m.user_id} className="h-8 w-8 border-2 border-background">
                                <AvatarImage src={m.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[10px]">{initials(m.display_name)}</AvatarFallback>
                              </Avatar>
                            ))}
                            {displayMembers.length > 3 && (
                              <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground text-xs">
                                +{displayMembers.length - 3}
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px]">
                          <div className="space-y-1">
                            {displayMembers.map((m) => (
                              <div key={m.user_id} className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[8px]">{initials(m.display_name)}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs">{m.display_name}</span>
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={person?.avatar_url ?? undefined} />
                        <AvatarFallback>{initials(person?.display_name ?? "?")}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {displayMembers.length > 1 
                          ? displayMembers.map(m => m.display_name).join(", ")
                          : person?.display_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{client?.name} • {stageLabel}</p>
                    </div>
                    <Badge variant={tone} className="h-3 w-3 rounded-full p-0" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
