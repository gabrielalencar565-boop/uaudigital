import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useSquads, useSquadMembers, useCreateSquad, useDeleteSquad, useUpdateSquadMembers, useUpdateSquad, useClientSquads } from "../hooks/use-squads";
import { useHealthScores } from "../hooks/use-health-scores";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Trash2, Settings2, Users, CheckCircle2, Clock, FileText,
  MoreHorizontal, CalendarDays, HeartPulse, Target, ChevronLeft, ChevronRight, Star, Shield
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  format, startOfMonth, endOfMonth, differenceInDays, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isToday, subMonths, addMonths
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { HealthScoreTab } from "./HealthScoreTab";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

const SQUAD_COLOR_PALETTE = [
  "#7C5CFF", "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#EC4899", "#8B5CF6", "#06B6D4", "#F97316",
];

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

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={cn("opacity-0", className)} style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

export function VisaoGeralTab() {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);
  const squadsQ = useSquads();
  const membersQ = useSquadMembers();
  const clientSquadsQ = useClientSquads();
  const createSquad = useCreateSquad();
  const deleteSquad = useDeleteSquad();
  const updateMembers = useUpdateSquadMembers();
  const updateSquad = useUpdateSquad();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#7C5CFF");
  const [newLeader, setNewLeader] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showHealthScore, setShowHealthScore] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [holidayFilter, setHolidayFilter] = useState<"all" | "comemorativas">("all");

  // Edit squad dialog
  const [editSquad, setEditSquad] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#7C5CFF");
  const [editLeader, setEditLeader] = useState<string>("");

  const teamQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url, role_title, birth_date").eq("is_active", true).order("display_name");
      return (data ?? []) as Array<{ user_id: string; display_name: string; avatar_url: string | null; role_title: string; birth_date: string | null }>;
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

  const healthQ = useHealthScores(now.getMonth() + 1, now.getFullYear());

  const squads = squadsQ.data ?? [];
  const allSquadMembers = membersQ.data ?? [];
  const allClientSquads = clientSquadsQ.data ?? [];
  const allTeam = teamQ.data ?? [];
  const allTasks = pmTasksQ.data ?? [];
  const healthScores = healthQ.data ?? [];

  const teamMap = useMemo(() => {
    const m: Record<string, typeof allTeam[0]> = {};
    allTeam.forEach((t) => { m[t.user_id] = t; });
    return m;
  }, [allTeam]);

  const healthAvgMap = useMemo(() => {
    const m: Record<string, number> = {};
    healthScores.forEach((s) => {
      m[s.client_id] = Math.round((s.resultado_percebido + s.alinhamento_estrategico + s.comunicacao_atendimento + s.qualidade_entregas + s.satisfacao_geral) / 5);
    });
    return m;
  }, [healthScores]);

  // Clients per squad from client_squads table
  const clientsPerSquad = useMemo(() => {
    const m: Record<string, string[]> = {};
    allClientSquads.forEach((cs: any) => {
      if (!m[cs.squad_id]) m[cs.squad_id] = [];
      m[cs.squad_id].push(cs.client_id);
    });
    return m;
  }, [allClientSquads]);

  // Stats per squad
  const squadStats = useMemo(() => {
    const stats: Record<string, { total: number; done: number; inProgress: number; overdue: number; memberIds: string[]; clientCount: number }> = {};
    squads.forEach((sq: any) => {
      const memberIds = allSquadMembers.filter((sm: any) => sm.squad_id === sq.id).map((sm: any) => sm.user_id);
      const tasks = allTasks.filter((t) => t.assignee_id && memberIds.includes(t.assignee_id));
      const done = tasks.filter((t) => t.status_global === "concluido").length;
      const inProgress = tasks.filter((t) => t.status_global === "em_andamento").length;
      const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < now && t.status_global !== "concluido").length;
      const clientCount = (clientsPerSquad[sq.id] ?? []).length;
      stats[sq.id] = { total: tasks.length, done, inProgress, overdue, memberIds, clientCount };
    });
    return stats;
  }, [squads, allSquadMembers, allTasks, clientsPerSquad]);

  // Global stats
  const globalStats = useMemo(() => {
    const total = allTasks.length;
    const done = allTasks.filter((t) => t.status_global === "concluido").length;
    const inProgress = allTasks.filter((t) => t.status_global === "em_andamento").length;
    return { total, done, inProgress };
  }, [allTasks]);

  const chartData = useMemo(() => {
    return squads.map((sq: any) => ({
      name: sq.name,
      contas: (clientsPerSquad[sq.id] ?? []).length,
    }));
  }, [squads, clientsPerSquad]);

  const handleCreate = () => {
    if (!newName.trim() || !user) return;
    createSquad.mutate({ name: newName.trim(), color: newColor, userId: user.id, leaderId: newLeader || undefined }, {
      onSuccess: () => { setCreateOpen(false); setNewName(""); setNewLeader(""); },
    });
  };

  const openEdit = (sq: any) => {
    const memberIds = allSquadMembers.filter((sm: any) => sm.squad_id === sq.id).map((sm: any) => sm.user_id);
    setSelectedUsers(memberIds);
    setEditSquad(sq);
    setEditName(sq.name);
    setEditColor(sq.color);
    setEditLeader(sq.leader_id ?? "");
  };

  const saveEdit = () => {
    if (!editSquad || !editName.trim()) return;
    // Save squad info + members in parallel
    updateSquad.mutate({ id: editSquad.id, name: editName.trim(), color: editColor, leaderId: editLeader || null });
    updateMembers.mutate({ squadId: editSquad.id, userIds: selectedUsers }, {
      onSuccess: () => setEditSquad(null),
    });
  };


  const toggleUser = (uid: string) => {
    setSelectedUsers((prev) => prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]);
  };

  // Calendar
  const calendarStart = startOfMonth(calMonth);
  const calendarEnd = endOfMonth(calMonth);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(calendarStart, { weekStartsOn: 0 }),
    end: endOfWeek(calendarEnd, { weekStartsOn: 0 }),
  });

  const weekDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const holidayMap = new Map(HOLIDAYS_2026.map((h) => [h.date, h.name]));
  const upcomingHolidays = HOLIDAYS_2026.filter((h) => new Date(h.date) >= now);

  // Birthdays from team members
  const teamBirthdays = useMemo(() => {
    return allTeam
      .filter((m) => m.birth_date)
      .map((m) => {
        const bd = new Date(m.birth_date + "T12:00:00");
        const thisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
        const nextBirthday = thisYear >= now ? thisYear : new Date(now.getFullYear() + 1, bd.getMonth(), bd.getDate());
        return {
          date: format(nextBirthday, "yyyy-MM-dd"),
          name: `🎂 ${m.display_name}`,
          type: "Aniversário",
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allTeam, now]);

  // Birthday map for calendar highlighting
  const birthdayMap = useMemo(() => {
    const map = new Map<string, string>();
    allTeam.filter((m) => m.birth_date).forEach((m) => {
      const bd = new Date(m.birth_date + "T12:00:00");
      const key = format(new Date(calMonth.getFullYear(), bd.getMonth(), bd.getDate()), "yyyy-MM-dd");
      const existing = map.get(key);
      map.set(key, existing ? `${existing}, ${m.display_name}` : `🎂 ${m.display_name}`);
    });
    return map;
  }, [allTeam, calMonth]);

  // Combined dates for "Próximas datas" widget
  const filteredDates = useMemo(() => {
    if (holidayFilter === "comemorativas") return teamBirthdays;
    return [...upcomingHolidays, ...teamBirthdays].sort((a, b) => a.date.localeCompare(b.date));
  }, [holidayFilter, upcomingHolidays, teamBirthdays]);

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
      <FadeUp delay={0}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Visão geral dos projetos</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {format(now, "dd/MM/yyyy")}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {format(now, "HH:mm:ss")}</span>
          </div>
        </div>
      </FadeUp>

      {/* Squad cards row */}
      <FadeUp delay={0.15}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {squads.map((sq: any, idx: number) => {
            const st = squadStats[sq.id] ?? { total: 0, done: 0, inProgress: 0, overdue: 0, memberIds: [], clientCount: 0 };
            const progress = st.total > 0 ? Math.round((st.done / st.total) * 100) : 0;
            const clientIds = clientsPerSquad[sq.id] ?? [];
            const healthVals = clientIds.map((c: string) => healthAvgMap[c]).filter((v) => v !== undefined);
            const avgHealth = healthVals.length > 0 ? Math.round(healthVals.reduce((a, b) => a + b, 0) / healthVals.length) : 0;
            const healthColor = avgHealth >= 80 ? "text-success" : avgHealth >= 50 ? "text-warning" : "text-danger";
            const members = st.memberIds.map((uid: string) => teamMap[uid]).filter(Boolean);

            return (
              <Card key={sq.id}>
                <CardContent className="py-5 px-5 space-y-4">
                  {/* Header with shield icon */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-11 w-11 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${sq.color}20` }}
                      >
                        <Shield className="h-5 w-5" style={{ color: sq.color }} />
                      </div>
                      <span className="text-base font-semibold">{sq.name}</span>
                    </div>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 flex items-center justify-center rounded-xl hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(sq)}><Settings2 className="h-4 w-4 mr-2" /> Editar Squad</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteSquad.mutate(sq.id)}><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Members avatars only */}
                  <div className="flex -space-x-2">
                    {members.slice(0, 6).map((m: any) => (
                      <Avatar key={m.user_id} className="h-8 w-8 border-2 border-card">
                        <AvatarImage src={m.avatar_url ?? undefined} alt={m.display_name} />
                        <AvatarFallback className="text-[10px] bg-muted">{initials(m.display_name)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {members.length > 6 && (
                      <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-card bg-muted text-muted-foreground text-[10px] font-medium">
                        +{members.length - 6}
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Progresso • <Clock className="h-3 w-3" /> {daysLeft} dias restantes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-2 flex-1" />
                      <span className="text-xs font-medium text-foreground">{progress}%</span>
                    </div>
                  </div>

                  {/* Health Score */}
                  <div className={cn("text-sm font-medium flex items-center gap-1.5", avgHealth > 0 ? healthColor : "text-muted-foreground")}>
                    <span className={cn("h-2 w-2 rounded-full", avgHealth >= 80 ? "bg-success" : avgHealth >= 50 ? "bg-warning" : avgHealth > 0 ? "bg-destructive" : "bg-muted-foreground")} />
                    <span className="font-bold">{avgHealth > 0 ? avgHealth : "—"}</span>
                    <span>Health Score</span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {members.length}</span>
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {st.clientCount}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {st.total}</span>
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
      </FadeUp>

      {/* Middle row */}
      <FadeUp delay={0.3}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

          <Card>
            <CardContent className="py-5 px-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center"><Users className="h-5 w-5 text-sidebar" /></div>
                <div>
                  <p className="text-sm font-semibold">Contas por Squad</p>
                  <p className="text-xs text-muted-foreground">Total: {new Set(allClientSquads.map((cs: any) => cs.client_id)).size} contas atribuídas</p>
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
      </FadeUp>

      {/* Tarefas gerais */}
      <FadeUp delay={0.45}>
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
      </FadeUp>

      {/* Calendar full-width */}
      <FadeUp delay={0.6}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Calendar — left 3 cols */}
          <Card className="lg:col-span-3">
            <CardContent className="py-5 px-5 space-y-4">
              {/* Header with month nav */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-sidebar/10 flex items-center justify-center">
                    <CalendarDays className="h-4 w-4 text-sidebar" />
                  </div>
                  <p className="text-base font-bold">Calendário</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCalMonth((d) => startOfMonth(subMonths(d, 1)))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-semibold capitalize min-w-[120px] text-center">
                    {format(calMonth, "MMMM yyyy", { locale: ptBR })}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCalMonth((d) => startOfMonth(addMonths(d, 1)))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                  <div key={d} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((d) => {
                  const key = format(d, "yyyy-MM-dd");
                  const inMonth = d.getMonth() === calMonth.getMonth();
                  const today = isToday(d);
                  const holiday = holidayMap.get(key);
                  const birthday = birthdayMap.get(key);
                  return (
                    <div
                      key={key}
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-lg py-2 text-xs transition-all",
                        !inMonth && "opacity-30",
                        today && "bg-sidebar text-sidebar-foreground font-bold shadow-md",
                        holiday && !today && "bg-primary/10",
                        birthday && !today && !holiday && "bg-warning/10"
                      )}
                      title={birthday ?? holiday ?? undefined}
                    >
                      <span>{format(d, "d")}</span>
                      {birthday && (
                        <span className="mt-0.5 text-[8px] leading-tight text-center truncate max-w-full px-0.5">🎂</span>
                      )}
                      {holiday && !birthday && (
                        <span className="mt-0.5 text-[8px] leading-tight text-center text-primary truncate max-w-full px-0.5">{holiday}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Próximas datas — right 2 cols */}
          <Card className="lg:col-span-2">
            <CardContent className="py-5 px-5 space-y-4">
              <p className="text-base font-bold">Próximas datas</p>

              <Tabs value={holidayFilter} onValueChange={(v) => setHolidayFilter(v as any)}>
                <TabsList className="bg-muted/40 h-9 p-1 rounded-full gap-1 w-full">
                  <TabsTrigger value="all" className="h-7 rounded-full text-xs data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-md flex-1 transition-all">Todas as datas</TabsTrigger>
                  <TabsTrigger value="comemorativas" className="h-7 rounded-full text-xs data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-md flex-1 transition-all">Aniversários</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {filteredDates.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma data próxima</p>
                )}
                {filteredDates.slice(0, 10).map((h, idx) => (
                  <div key={`${h.date}-${idx}`} className="flex items-start gap-3 rounded-xl border border-sidebar/20 bg-sidebar/5 p-3.5 transition-colors hover:bg-sidebar/10">
                    <div className="h-9 w-9 rounded-full bg-sidebar/15 flex items-center justify-center flex-shrink-0">
                      {h.type === "Aniversário" ? <span className="text-base">🎂</span> : <Star className="h-4 w-4 text-sidebar" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{h.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-sidebar">{format(new Date(h.date + "T12:00:00"), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                        <span className="text-[10px] text-muted-foreground">{h.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeUp>
      {/* Health Score access */}
      <FadeUp delay={0.75}>
        <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setShowHealthScore(true)}>
          <CardContent className="flex items-center gap-4 py-4 px-5">
            <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center"><HeartPulse className="h-5 w-5 text-sidebar" /></div>
            <div>
              <p className="text-sm font-semibold">Health Score</p>
              <p className="text-xs text-muted-foreground">Avaliar saúde dos clientes</p>
            </div>
          </CardContent>
        </Card>
      </FadeUp>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar Squad</DialogTitle>
            <DialogDescription>Defina o nome, cor e líder do squad.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input placeholder="Nome do squad" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Cor</label>
              <div className="flex items-center gap-2.5 mt-2">
                {SQUAD_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn("h-9 w-9 rounded-full transition-all", newColor === c ? "ring-2 ring-offset-2 ring-foreground" : "")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Líder do Squad</label>
              <Select value={newLeader} onValueChange={setNewLeader}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um líder (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {allTeam.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button variant="hero" onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit squad dialog */}
      <Dialog open={!!editSquad} onOpenChange={(v) => !v && setEditSquad(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Squad</DialogTitle>
            <DialogDescription>Altere os dados do squad.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Cor</label>
              <div className="flex items-center gap-2.5 mt-2">
                {SQUAD_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={cn("h-9 w-9 rounded-full transition-all", editColor === c ? "ring-2 ring-offset-2 ring-foreground" : "")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Líder do Squad</label>
              <Select value={editLeader} onValueChange={setEditLeader}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um líder (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {allTeam.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Membros</label>
              <div className="max-h-48 overflow-y-auto space-y-1 mt-2 border border-border rounded-xl p-2">
                {allTeam.map((m) => (
                  <label key={m.user_id} className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selectedUsers.includes(m.user_id)} onCheckedChange={() => toggleUser(m.user_id)} />
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[9px]">{initials(m.display_name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{m.display_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditSquad(null)}>Cancelar</Button>
            <Button variant="hero" onClick={saveEdit} disabled={!editName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
