import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSquads, useSquadMembers, useCreateSquad, useDeleteSquad, useUpdateSquadMembers } from "../hooks/use-squads";
import { useHealthScores } from "../hooks/use-health-scores";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Trash2, Settings2, Users, CheckCircle2, Clock, FileText,
  MoreHorizontal, CalendarDays, HeartPulse, Target, ChevronLeft, ChevronRight, Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  format, startOfMonth, endOfMonth, differenceInDays, startOfWeek, endOfWeek,
  addDays, eachDayOfInterval, isSameDay, isToday
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { HealthScoreTab } from "./HealthScoreTab";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

// Brazilian holidays (static)
const HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "Confraternização Universal", type: "Feriado Nacional" },
  { date: "2026-02-16", name: "Carnaval", type: "Feriado Nacional" },
  { date: "2026-02-17", name: "Carnaval", type: "Feriado Nacional" },
  { date: "2026-04-03", name: "Sexta-feira Santa", type: "Feriado Nacional" },
  { date: "2026-04-21", name: "Tiradentes", type: "Feriado Nacional" },
  { date: "2026-05-01", name: "Dia do Trabalho", type: "Feriado Nacional" },
  { date: "2026-06-04", name: "Corpus Christi", type: "Feriado Nacional" },
  { date: "2026-09-07", name: "Independência do Brasil", type: "Feriado Nacional" },
  { date: "2026-10-12", name: "Nossa Senhora Aparecida", type: "Feriado Nacional" },
  { date: "2026-11-02", name: "Finados", type: "Feriado Nacional" },
  { date: "2026-11-15", name: "Proclamação da República", type: "Feriado Nacional" },
  { date: "2026-11-20", name: "Dia da Consciência Negra", type: "Feriado Nacional" },
  { date: "2026-12-25", name: "Natal", type: "Feriado Nacional" },
];

export function VisaoGeralTab() {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);
  const squadsQ = useSquads();
  const membersQ = useSquadMembers();
  const createSquad = useCreateSquad();
  const deleteSquad = useDeleteSquad();
  const updateMembers = useUpdateSquadMembers();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#7C5CFF");
  const [configSquad, setConfigSquad] = useState<any>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showHealthScore, setShowHealthScore] = useState(false);

  const teamQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url, role_title").eq("is_active", true).order("display_name");
      return data ?? [];
    },
  });

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const daysLeft = differenceInDays(endOfMonth(now), now);

  const pmTasksQ = useQuery({
    queryKey: ["pm_tasks_overview", monthStart],
    queryFn: async () => {
      const { data } = await supabase.from("pm_tasks")
        .select("id, assignee_id, status_global, stage_current, due_date, client_id, title")
        .eq("is_draft", false)
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd);
      return data ?? [];
    },
  });

  // Health scores
  const healthQ = useHealthScores(now.getMonth() + 1, now.getFullYear());

  const squads = squadsQ.data ?? [];
  const allSquadMembers = membersQ.data ?? [];
  const allTeam = teamQ.data ?? [];
  const allTasks = pmTasksQ.data ?? [];
  const healthScores = healthQ.data ?? [];

  const teamMap = useMemo(() => {
    const m: Record<string, typeof allTeam[0]> = {};
    allTeam.forEach((t) => { m[t.user_id] = t; });
    return m;
  }, [allTeam]);

  // Health score average per client
  const healthAvgMap = useMemo(() => {
    const m: Record<string, number> = {};
    healthScores.forEach((s) => {
      m[s.client_id] = Math.round((s.resultado_percebido + s.alinhamento_estrategico + s.comunicacao_atendimento + s.qualidade_entregas + s.satisfacao_geral) / 5);
    });
    return m;
  }, [healthScores]);

  // Stats per squad
  const squadStats = useMemo(() => {
    const stats: Record<string, { total: number; done: number; inProgress: number; overdue: number; memberIds: string[]; clients: Set<string> }> = {};
    squads.forEach((sq: any) => {
      const memberIds = allSquadMembers.filter((sm: any) => sm.squad_id === sq.id).map((sm: any) => sm.user_id);
      const tasks = allTasks.filter((t) => t.assignee_id && memberIds.includes(t.assignee_id));
      const done = tasks.filter((t) => t.status_global === "concluido").length;
      const inProgress = tasks.filter((t) => t.status_global === "em_andamento").length;
      const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < now && t.status_global !== "concluido").length;
      const clients = new Set(tasks.map((t) => t.client_id));
      stats[sq.id] = { total: tasks.length, done, inProgress, overdue, memberIds, clients };
    });
    return stats;
  }, [squads, allSquadMembers, allTasks]);

  // Global stats
  const globalStats = useMemo(() => {
    const total = allTasks.length;
    const done = allTasks.filter((t) => t.status_global === "concluido").length;
    const inProgress = allTasks.filter((t) => t.status_global === "em_andamento").length;
    return { total, done, inProgress };
  }, [allTasks]);

  // Contas por squad chart data
  const chartData = useMemo(() => {
    return squads.map((sq: any) => ({
      name: sq.name,
      contas: squadStats[sq.id]?.clients.size ?? 0,
    }));
  }, [squads, squadStats]);

  const handleCreate = () => {
    if (!newName.trim() || !user) return;
    createSquad.mutate({ name: newName.trim(), color: newColor, userId: user.id }, {
      onSuccess: () => { setCreateOpen(false); setNewName(""); },
    });
  };

  const openConfig = (sq: any) => {
    const memberIds = allSquadMembers.filter((sm: any) => sm.squad_id === sq.id).map((sm: any) => sm.user_id);
    setSelectedUsers(memberIds);
    setConfigSquad(sq);
  };

  const saveConfig = () => {
    if (!configSquad) return;
    updateMembers.mutate({ squadId: configSquad.id, userIds: selectedUsers }, {
      onSuccess: () => setConfigSquad(null),
    });
  };

  const toggleUser = (uid: string) => {
    setSelectedUsers((prev) => prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]);
  };

  // Calendar
  const calendarStart = startOfMonth(now);
  const calendarEnd = endOfMonth(now);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(calendarStart, { weekStartsOn: 0 }),
    end: endOfWeek(calendarEnd, { weekStartsOn: 0 }),
  });

  const weekDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

  // Upcoming holidays
  const upcomingHolidays = HOLIDAYS_2026.filter((h) => new Date(h.date) >= now).slice(0, 4);

  if (showHealthScore) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setShowHealthScore(false)} className="gap-1.5">
          ← Voltar à Visão Geral
        </Button>
        <HealthScoreTab />
      </div>
    );
  }

  const progressPct = globalStats.total > 0 ? Math.round((globalStats.done / globalStats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <h1 className="text-xl font-bold text-foreground">Visão geral dos projetos</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {format(now, "dd/MM/yyyy")}</span>
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {format(now, "HH:mm:ss")}</span>
        </div>
      </div>

      {/* Squad cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.15s" }}>
        {squads.map((sq: any) => {
          const st = squadStats[sq.id] ?? { total: 0, done: 0, inProgress: 0, overdue: 0, memberIds: [], clients: new Set() };
          const progress = st.total > 0 ? Math.round((st.done / st.total) * 100) : 0;
          const clientIds = Array.from(st.clients);
          const healthVals = clientIds.map((c) => healthAvgMap[c]).filter((v) => v !== undefined);
          const avgHealth = healthVals.length > 0 ? Math.round(healthVals.reduce((a, b) => a + b, 0) / healthVals.length) : 0;
          const healthColor = avgHealth >= 80 ? "text-success" : avgHealth >= 50 ? "text-warning" : "text-danger";
          const members = st.memberIds.map((uid: string) => teamMap[uid]).filter(Boolean);

          return (
            <Card key={sq.id}>
              <CardContent className="py-5 px-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-full border-[3px]" style={{ borderColor: sq.color }} />
                    <span className="text-base font-semibold">{sq.name}</span>
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openConfig(sq)}><Settings2 className="h-4 w-4 mr-2" /> Configurar membros</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteSquad.mutate(sq.id)}><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Members avatars */}
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {members.slice(0, 5).map((m: any) => (
                      <Avatar key={m.user_id} className="h-9 w-9 border-2 border-card">
                        <AvatarImage src={m.avatar_url ?? undefined} alt={m.display_name} />
                        <AvatarFallback className="text-[10px] bg-muted">{initials(m.display_name)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {members.length > 5 && (
                      <div className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-card bg-muted text-muted-foreground text-xs font-medium">
                        +{members.length - 5}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{members.length} {members.length === 1 ? "membro" : "membros"}</span>
                </div>

                {/* Progress */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Progresso</span>
                    <span className="font-medium text-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {daysLeft} dias restantes</p>
                </div>

                {/* Health Score */}
                <div className={cn("text-sm font-medium flex items-center gap-1.5", healthColor)}>
                  <HeartPulse className="h-4 w-4" />
                  <span>{avgHealth > 0 ? `${avgHealth} Health Score` : "Sem avaliação"}</span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {st.clients.size} contas</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {st.total} tarefas</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> {st.done}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add squad card */}
        {isAdmin && (
          <Card className="border-dashed cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setCreateOpen(true)}>
            <CardContent className="flex flex-col items-center justify-center py-10 px-5 gap-2 h-full">
              <Plus className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Criar Squad</span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Middle row: Planejamentos + Contas por squad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Planejamentos gerais */}
        <Card>
          <CardContent className="py-5 px-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center"><FileText className="h-5 w-5 text-sidebar" /></div>
              <div>
                <p className="text-sm font-semibold">Planejamentos gerais</p>
                <p className="text-xs text-muted-foreground">Planejamentos a serem entregues</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold">{globalStats.done}/{globalStats.total}</span>
              <span className="text-sm text-muted-foreground">{progressPct}% completado</span>
            </div>
          </CardContent>
        </Card>

        {/* Contas por Squad */}
        <Card>
          <CardContent className="py-5 px-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center"><Users className="h-5 w-5 text-sidebar" /></div>
              <div>
                <p className="text-sm font-semibold">Contas por Squad</p>
                <p className="text-xs text-muted-foreground">Total: {new Set(allTasks.map((t) => t.client_id)).size} contas ativas</p>
              </div>
            </div>
            {chartData.length > 0 ? (
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="contas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Crie squads para ver o gráfico</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tarefas gerais */}
      <Card>
        <CardContent className="py-5 px-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-sidebar" /></div>
            <div>
              <p className="text-sm font-semibold">Tarefas gerais</p>
              <p className="text-xs text-muted-foreground">Tarefas em andamento</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold">{globalStats.done}/{globalStats.total}</span>
            <span className="text-sm text-muted-foreground">{progressPct}% completado</span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom row: Timeline + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timeline placeholder */}
        <Card>
          <CardContent className="py-5 px-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center"><CalendarDays className="h-5 w-5 text-sidebar" /></div>
              <p className="text-sm font-semibold">Timeline de projetos especiais</p>
            </div>
            <div className="text-center py-8 text-xs text-muted-foreground">
              Semana de {format(startOfWeek(now, { weekStartsOn: 0 }), "d 'de' MMMM, yyyy", { locale: ptBR })}
            </div>
          </CardContent>
        </Card>

        {/* Calendar + holidays */}
        <Card>
          <CardContent className="py-5 px-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-sidebar/10 flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-sidebar" />
              </div>
              <p className="text-base font-bold">Calendário</p>
            </div>

            <div className="flex gap-6">
              {/* Mini calendar */}
              <div className="flex-1 border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <button className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="text-sm font-medium capitalize">{format(now, "MMMM yyyy", { locale: ptBR })}</p>
                  <button className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {weekDays.map((d) => (
                    <span key={d} className="text-xs text-muted-foreground font-medium py-1.5">{d}</span>
                  ))}
                  {calendarDays.map((day, i) => {
                    const inMonth = day.getMonth() === now.getMonth();
                    const today = isToday(day);
                    const isHoliday = HOLIDAYS_2026.some((h) => isSameDay(new Date(h.date), day));
                    return (
                      <span
                        key={i}
                        className={cn(
                          "py-1.5 rounded-lg text-sm font-medium transition-colors",
                          !inMonth && "text-muted-foreground/30",
                          inMonth && !today && !isHoliday && "text-foreground",
                          today && "bg-sidebar text-sidebar-foreground font-bold",
                          isHoliday && !today && inMonth && "bg-sidebar/15 text-sidebar font-bold"
                        )}
                      >
                        {day.getDate()}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Upcoming holidays */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold">Próximas datas</p>
                </div>
                <div className="flex gap-2 mb-1">
                  <span className="text-xs font-medium bg-sidebar text-sidebar-foreground px-3 py-1 rounded-full">Todas as datas</span>
                  <span className="text-xs font-medium text-muted-foreground px-3 py-1 rounded-full border border-border">Datas comemorativas</span>
                </div>
                <div className="space-y-2.5">
                  {upcomingHolidays.map((h) => (
                    <div key={h.date} className="flex items-center gap-3 rounded-xl border border-sidebar/30 bg-sidebar/5 px-4 py-3">
                      <div className="h-8 w-8 rounded-full bg-sidebar/15 flex items-center justify-center flex-shrink-0">
                        <Star className="h-4 w-4 text-sidebar" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-sidebar">{h.name}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(h.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{h.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Score access */}
      <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setShowHealthScore(true)}>
        <CardContent className="flex items-center gap-4 py-4 px-5">
          <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center"><HeartPulse className="h-5 w-5 text-sidebar" /></div>
          <div>
            <p className="text-sm font-semibold">Health Score</p>
            <p className="text-xs text-muted-foreground">Avaliar saúde dos clientes</p>
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Criar Squad</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome do squad" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Cor:</label>
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config members dialog */}
      <Dialog open={!!configSquad} onOpenChange={(v) => !v && setConfigSquad(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Membros — {configSquad?.name}</DialogTitle></DialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {allTeam.map((m) => (
              <label key={m.user_id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selectedUsers.includes(m.user_id)} onCheckedChange={() => toggleUser(m.user_id)} />
                <Avatar className="h-7 w-7">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">{initials(m.display_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{m.display_name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.role_title}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={saveConfig}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
