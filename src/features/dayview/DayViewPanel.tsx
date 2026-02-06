import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useClients, useTasks, useTeamMembers } from "@/features/data/queries";
import { supabase } from "@/integrations/supabase/client";
import { useTaskAssigneesByMonth } from "@/features/data/task-assignees-queries";
import { Magic2Dashboard } from "@/features/magic2/components/Magic2Dashboard";
import { useMagic2Dashboard } from "@/features/magic2/hooks/use-magic2-dashboard";
import { MonthYearNav } from "@/features/magic2/components/MonthYearNav";
import { STAGES } from "@/lib/uau";
import { cn } from "@/lib/utils";
import { RefreshCw, Calendar, Target, RotateCcw, Trophy } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("");
}
function statusTone(status: string, dueDate: string, todayKey: string) {
  if (status === "concluido") return "success" as const;
  if (dueDate < todayKey) return "destructive" as const;
  return "warning" as const;
}
export function DayViewPanel() {
  const [active, setActive] = useState<"magic" | "agenda" | "podio">("magic");
  const [autoRotate, setAutoRotate] = useState(true);
  const [isHoveringRotateBtn, setIsHoveringRotateBtn] = useState(false);
  const [rotateInterval, setRotateInterval] = useState(10_000); // 10s padrão
  const now = useNow({
    intervalMs: 30_000
  });
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
  const tasksQ = useTasks({
    month: monthKey
  });
  const magic2 = useMagic2Dashboard(selectedYear, selectedMonth);
  const assigneesQ = useTaskAssigneesByMonth(monthKey);

  // Performance scores for podium
  type ScoreRow = {
    user_id: string;
    year: number;
    month: number;
    aprendizado_continuo: number;
    padrao_qualidade_uau: number;
    metas_prazos: number;
    ambiente_organizado: number;
    comprometimento: number;
  };

  const scoresQ = useQuery({
    queryKey: ["performance_scores", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_scores")
        .select("*")
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .order("user_id");
      if (error) throw error;
      return (data ?? []) as ScoreRow[];
    },
  });

  const monthlyRank = useMemo(() => {
    const scores = scoresQ.data ?? [];
    const byUser = new Map(scores.map((s) => [s.user_id, s]));
    const members = teamQ.data ?? [];
    const base = members.map((m) => {
      const s = byUser.get(m.user_id);
      const total =
        (s?.aprendizado_continuo ?? 0) +
        (s?.padrao_qualidade_uau ?? 0) +
        (s?.metas_prazos ?? 0) +
        (s?.ambiente_organizado ?? 0) +
        (s?.comprometimento ?? 0);
      return { user_id: m.user_id, total };
    });
    base.sort((a, b) => b.total - a.total);
    return base;
  }, [scoresQ.data, teamQ.data]);
  const clientsById = useMemo(() => new Map((clientsQ.data ?? []).map(c => [c.id, c] as const)), [clientsQ.data]);
  const teamByUserId = useMemo(() => new Map((teamQ.data ?? []).map(m => [m.user_id, m] as const)), [teamQ.data]);

  // Mapa de múltiplos assignees por tarefa
  const assigneesByTaskId = useMemo(() => {
    const map = new Map<string, {
      user_id: string;
      display_name: string;
      avatar_url?: string | null;
    }[]>();
    for (const a of assigneesQ.data ?? []) {
      const member = teamByUserId.get(a.user_id);
      if (!member) continue;
      const prev = map.get(a.task_id) ?? [];
      prev.push({
        user_id: a.user_id,
        display_name: member.display_name,
        avatar_url: member.avatar_url
      });
      map.set(a.task_id, prev);
    }
    return map;
  }, [assigneesQ.data, teamByUserId]);

  // Se estamos visualizando o mês atual, mostrar tarefas de hoje
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  // Tarefas de hoje (exceto concluídas - elas vão separadas)
  const todayPendingTasks = useMemo(() => {
    const tasks = (tasksQ.data ?? []).filter(t => {
      if (!isCurrentMonth) return t.status !== "concluido";
      return t.due_date === todayKey && t.status !== "concluido";
    });
    return tasks.sort((a, b) => {
      const w = (s: string) => s === "em_andamento" ? 0 : 1;
      const dw = w(a.status) - w(b.status);
      if (dw !== 0) return dw;
      const na = teamByUserId.get(a.assigned_user_id)?.display_name ?? "";
      const nb = teamByUserId.get(b.assigned_user_id)?.display_name ?? "";
      return na.localeCompare(nb);
    });
  }, [tasksQ.data, todayKey, teamByUserId, isCurrentMonth]);

  // Tarefas concluídas de hoje
  const todayCompletedTasks = useMemo(() => {
    const tasks = (tasksQ.data ?? []).filter(t => {
      if (!isCurrentMonth) return t.status === "concluido";
      return t.due_date === todayKey && t.status === "concluido";
    });
    return tasks.sort((a, b) => {
      const na = teamByUserId.get(a.assigned_user_id)?.display_name ?? "";
      const nb = teamByUserId.get(b.assigned_user_id)?.display_name ?? "";
      return na.localeCompare(nb);
    });
  }, [tasksQ.data, todayKey, teamByUserId, isCurrentMonth]);
  const overdueTasks = useMemo(() => {
    return (tasksQ.data ?? []).filter(t => t.status !== "concluido" && t.due_date < todayKey).sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [tasksQ.data, todayKey]);
  const completedTasksCount = useMemo(() => (tasksQ.data ?? []).filter(t => t.status === "concluido").length, [tasksQ.data]);
  const totalTasks = tasksQ.data?.length ?? 0;

  // Navegação rápida para hoje
  const goToToday = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  };
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([queryClient.invalidateQueries({
      queryKey: ["magic2"]
    }), queryClient.invalidateQueries({
      queryKey: ["tasks"]
    }), queryClient.invalidateQueries({
      queryKey: ["clients"]
    }), queryClient.invalidateQueries({
      queryKey: ["team_members"]
    })]);
    setIsRefreshing(false);
    toast.success("Dados atualizados!");
  };

  // Auto-alternância com intervalo configurável
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setActive(v => v === "magic" ? "agenda" : v === "agenda" ? "podio" : "magic");
    }, rotateInterval);
    return () => clearInterval(interval);
  }, [autoRotate, rotateInterval]);

  // Parar auto-rotate quando clicar manualmente
  const handleManualTabChange = () => {
    setActive(v => v === "magic" ? "agenda" : v === "agenda" ? "podio" : "magic");
  };
  // Calcular dias restantes até o prazo final (dia 27 do mês selecionado)
  const deadlineDate = new Date(selectedYear, selectedMonth - 1, 27);
  const daysUntilDeadline = differenceInCalendarDays(deadlineDate, today);

  return <div className="space-y-6">
      {/* Header em uma única linha */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Visão do Dia</h2>
          <span className={cn(
            "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold text-white",
            daysUntilDeadline > 0 && "bg-success",
            daysUntilDeadline === 0 && "bg-warning text-warning-foreground",
            daysUntilDeadline < 0 && "bg-destructive"
          )}>
            {daysUntilDeadline > 0 
              ? `Faltam ${daysUntilDeadline} ${daysUntilDeadline === 1 ? "dia" : "dias"}`
              : daysUntilDeadline === 0 
                ? "É hoje!"
                : `Atrasado ${Math.abs(daysUntilDeadline)} ${Math.abs(daysUntilDeadline) === 1 ? "dia" : "dias"}`
            }
          </span>
        </div>
        
        {/* Controles à direita */}
        <div className="flex items-center gap-2">
          {/* Botão Rodando/Pausado */}
          <Button 
            variant={autoRotate ? "default" : "outline"}
            size="sm" 
            onClick={() => setAutoRotate(!autoRotate)}
            onMouseEnter={() => setIsHoveringRotateBtn(true)}
            onMouseLeave={() => setIsHoveringRotateBtn(false)}
            className={cn(
              "h-9 min-w-[90px]",
              autoRotate && "bg-success hover:bg-success/90 text-success-foreground"
            )}
          >
            {autoRotate 
              ? (isHoveringRotateBtn ? "Pausado" : "Rodando") 
              : (isHoveringRotateBtn ? "Rodando" : "Pausado")
            }
          </Button>
          
          {/* Botão de troca de tela */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleManualTabChange} 
            className="h-9"
          >
            {active === "magic" ? "Ir para Agenda" : active === "agenda" ? "Ir para Pódio" : "Ir para Magic"}
          </Button>

          {/* Dropdown de intervalo */}
          <select 
            value={String(rotateInterval)} 
            onChange={e => setRotateInterval(Number(e.target.value))} 
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="5000">5s</option>
            <option value="10000">10s</option>
            <option value="15000">15s</option>
            <option value="30000">30s</option>
          </select>

          {/* Seletores de mês/ano */}
          <select value={String(selectedMonth)} onChange={e => setSelectedMonth(Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {Array.from({
            length: 12
          }, (_, i) => i + 1).map(m => <option key={m} value={m}>
                {format(new Date(selectedYear, m - 1, 1), "MMMM", {
              locale: ptBR
            })}
              </option>)}
          </select>

          <select value={String(selectedYear)} onChange={e => setSelectedYear(Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing} className="h-9 w-9">
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      {active === "magic" ? <div className="space-y-4">
          
          {magic2.query.isLoading ? <Card>
              <CardHeader>
                <CardTitle>Carregando…</CardTitle>
                <CardDescription>Buscando dados do mês selecionado.</CardDescription>
              </CardHeader>
            </Card> : magic2.cycles.length ? <Magic2Dashboard dashboard={magic2.dashboard} year={selectedYear} month={selectedMonth} /> : <Card className="border-dashed">
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
            </Card>}
        </div> : active === "agenda" ? <Card>
          <CardHeader>
            <CardTitle>
              {isCurrentMonth ? "Agenda de Hoje" : `Agenda de ${format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM", {
            locale: ptBR
          })}`}
            </CardTitle>
            <CardDescription>
              {overdueTasks.length ? `${overdueTasks.length} atrasada(s) • ` : ""}
              {completedTasksCount}/{totalTasks} concluída(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tarefas Atrasadas - Widget Vermelho */}
            {overdueTasks.length > 0 && <div className="space-y-2">
                <p className="text-xs font-medium text-destructive uppercase tracking-wide">Atrasadas</p>
                {overdueTasks.map(t => {
            const members = assigneesByTaskId.get(t.id) ?? [];
            const person = teamByUserId.get(t.assigned_user_id);
            const client = clientsById.get(t.client_id);
            const stageLabel = STAGES.find(s => s.key === t.stage)?.label ?? t.stage;
            const daysLate = differenceInCalendarDays(today, new Date(`${t.due_date}T00:00:00`));
            const displayMembers = members.length > 0 ? members : person ? [{
              user_id: person.user_id,
              display_name: person.display_name,
              avatar_url: person.avatar_url
            }] : [];
            return <div key={t.id} className="flex items-center gap-3 rounded-lg bg-destructive px-3 py-2">
                      {displayMembers.length > 1 ? <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex -space-x-2 shrink-0">
                              {displayMembers.slice(0, 3).map(m => <Avatar key={m.user_id} className="h-8 w-8 border-2 border-destructive-foreground/30">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[10px] bg-destructive-foreground/20 text-destructive-foreground">{initials(m.display_name)}</AvatarFallback>
                                </Avatar>)}
                              {displayMembers.length > 3 && <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-destructive-foreground/30 bg-destructive-foreground/20 text-destructive-foreground text-xs">
                                  +{displayMembers.length - 3}
                                </div>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <div className="space-y-1">
                              {displayMembers.map(m => <div key={m.user_id} className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={m.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-[8px]">{initials(m.display_name)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs">{m.display_name}</span>
                                </div>)}
                            </div>
                          </TooltipContent>
                        </Tooltip> : <Avatar className="h-8 w-8 border-2 border-destructive-foreground/30">
                          <AvatarImage src={person?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-destructive-foreground/20 text-destructive-foreground">{initials(person?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-destructive-foreground">
                          {displayMembers.length > 1 ? displayMembers.map(m => m.display_name).join(", ") : person?.display_name}
                          {" "}•{" "}({client?.name}) • {stageLabel}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-destructive-foreground shrink-0">
                        {daysLate} {daysLate === 1 ? "dia" : "dias"}
                      </span>
                    </div>;
          })}
              </div>}

            {/* Tarefas de Hoje (Pendentes/Em Andamento) - Widget Branco */}
            {todayPendingTasks.length > 0 && <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isCurrentMonth ? "Hoje" : "Pendentes"}
                </p>
                {todayPendingTasks.map(t => {
            const members = assigneesByTaskId.get(t.id) ?? [];
            const person = teamByUserId.get(t.assigned_user_id);
            const client = clientsById.get(t.client_id);
            const stageLabel = STAGES.find(s => s.key === t.stage)?.label ?? t.stage;
            const displayMembers = members.length > 0 ? members : person ? [{
              user_id: person.user_id,
              display_name: person.display_name,
              avatar_url: person.avatar_url
            }] : [];
            return <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                      {displayMembers.length > 1 ? <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex -space-x-2 shrink-0">
                              {displayMembers.slice(0, 3).map(m => <Avatar key={m.user_id} className="h-8 w-8 border-2 border-background">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[10px]">{initials(m.display_name)}</AvatarFallback>
                                </Avatar>)}
                              {displayMembers.length > 3 && <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground text-xs">
                                  +{displayMembers.length - 3}
                                </div>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <div className="space-y-1">
                              {displayMembers.map(m => <div key={m.user_id} className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={m.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-[8px]">{initials(m.display_name)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs">{m.display_name}</span>
                                </div>)}
                            </div>
                          </TooltipContent>
                        </Tooltip> : <Avatar className="h-8 w-8">
                          <AvatarImage src={person?.avatar_url ?? undefined} />
                          <AvatarFallback>{initials(person?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {displayMembers.length > 1 ? displayMembers.map(m => m.display_name).join(", ") : person?.display_name}
                          {" "}•{" "}({client?.name}) • {stageLabel}
                        </p>
                      </div>
                      <Badge variant={t.status === "em_andamento" ? "warning" : "secondary"} className="text-xs shrink-0">
                        {t.status === "em_andamento" ? "Em andamento" : "Pendente"}
                      </Badge>
                    </div>;
          })}
              </div>}

            {/* Tarefas Concluídas - Widget Verde */}
            {todayCompletedTasks.length > 0 && <div className="space-y-2">
                <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Concluídas</p>
                {todayCompletedTasks.map(t => {
            const members = assigneesByTaskId.get(t.id) ?? [];
            const person = teamByUserId.get(t.assigned_user_id);
            const client = clientsById.get(t.client_id);
            const stageLabel = STAGES.find(s => s.key === t.stage)?.label ?? t.stage;
            const displayMembers = members.length > 0 ? members : person ? [{
              user_id: person.user_id,
              display_name: person.display_name,
              avatar_url: person.avatar_url
            }] : [];
            return <div key={t.id} className="flex items-center gap-3 rounded-lg bg-success px-3 py-2">
                      {displayMembers.length > 1 ? <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex -space-x-2 shrink-0">
                              {displayMembers.slice(0, 3).map(m => <Avatar key={m.user_id} className="h-8 w-8 border-2 border-success-foreground/30">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[10px] bg-success-foreground/20 text-success-foreground">{initials(m.display_name)}</AvatarFallback>
                                </Avatar>)}
                              {displayMembers.length > 3 && <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-success-foreground/30 bg-success-foreground/20 text-success-foreground text-xs">
                                  +{displayMembers.length - 3}
                                </div>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <div className="space-y-1">
                              {displayMembers.map(m => <div key={m.user_id} className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={m.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-[8px]">{initials(m.display_name)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs">{m.display_name}</span>
                                </div>)}
                            </div>
                          </TooltipContent>
                        </Tooltip> : <Avatar className="h-8 w-8 border-2 border-success-foreground/30">
                          <AvatarImage src={person?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-success-foreground/20 text-success-foreground">{initials(person?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-success-foreground">
                          {displayMembers.length > 1 ? displayMembers.map(m => m.display_name).join(", ") : person?.display_name}
                          {" "}•{" "}({client?.name}) • {stageLabel}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-success-foreground shrink-0">
                        ✓
                      </span>
                    </div>;
          })}
              </div>}

            {/* Mensagem quando não há tarefas */}
            {todayPendingTasks.length === 0 && todayCompletedTasks.length === 0 && overdueTasks.length === 0 && <p className="text-muted-foreground text-center py-4">
                {isCurrentMonth ? "Nenhuma tarefa para hoje 🎉" : "Nenhuma tarefa neste mês"}
              </p>}
           </CardContent>
         </Card> : (
          /* ─── Pódio ─── */
         /* ─── Pódio ─── */
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Trophy className="h-5 w-5" />
               Ranking de Performance
             </CardTitle>
             <CardDescription>
               {format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", { locale: ptBR })}
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             {/* Top 3 podium cards */}
             <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
               {monthlyRank.slice(0, 3).map((row, idx) => {
                 const member = teamByUserId.get(row.user_id);
                 const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                 return (
                   <Card
                     key={row.user_id}
                     className={cn(
                       "overflow-hidden border",
                       idx === 0 && "bg-primary/5 border-primary/25 shadow-sm",
                       idx === 1 && "bg-muted/20 border-border/60 md:mt-4",
                       idx === 2 && "bg-secondary/20 border-border/60 md:mt-8",
                     )}
                   >
                     <CardContent className={cn("flex flex-col items-center text-center", idx === 0 ? "p-6" : "p-4")}>
                       <span className={cn("leading-none", idx === 0 ? "text-4xl" : "text-3xl")}>{medal}</span>
                       <Avatar className={cn("mt-3 shadow-sm", idx === 0 ? "h-20 w-20" : "h-16 w-16")}>
                         <AvatarImage src={member?.avatar_url ?? undefined} />
                         <AvatarFallback className="text-lg">{initials(member?.display_name ?? "?")}</AvatarFallback>
                       </Avatar>
                       <p className={cn("mt-3 font-semibold", idx === 0 ? "text-xl" : "text-lg")}>
                         {member?.display_name ?? "—"}
                       </p>
                       <div className="flex items-baseline gap-1 mt-1">
                         <span className={cn("font-bold text-primary tabular-nums", idx === 0 ? "text-4xl" : "text-3xl")}>
                           {row.total}
                         </span>
                         <span className="text-sm text-muted-foreground">pts</span>
                       </div>
                     </CardContent>
                   </Card>
                 );
               })}
             </div>

             {/* Restante do ranking */}
             {monthlyRank.length > 3 && (
               <div className="space-y-2">
                 {monthlyRank.slice(3).map((row, idx) => {
                   const member = teamByUserId.get(row.user_id);
                   return (
                     <div key={row.user_id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                       <span className="text-lg font-semibold text-muted-foreground w-8 text-center">{idx + 4}º</span>
                       <Avatar className="h-10 w-10">
                         <AvatarImage src={member?.avatar_url ?? undefined} />
                         <AvatarFallback>{initials(member?.display_name ?? "?")}</AvatarFallback>
                       </Avatar>
                       <span className="flex-1 font-medium">{member?.display_name ?? "—"}</span>
                       <span className="text-xl font-bold text-primary tabular-nums">{row.total}</span>
                       <span className="text-sm text-muted-foreground">pts</span>
                     </div>
                   );
                 })}
               </div>
             )}

             {monthlyRank.length === 0 && (
               <p className="text-muted-foreground text-center py-4">Nenhum dado de performance para este mês</p>
             )}
           </CardContent>
         </Card>
       )}
    </div>;
}