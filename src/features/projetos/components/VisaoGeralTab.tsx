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
  MoreHorizontal, CalendarDays, HeartPulse, Target, ChevronLeft, ChevronRight, Star, Shield,
  BarChart2, ChevronsUpDown, Sword, Crown, Flame, Zap, Rocket, Diamond, Award, Trophy,
  Heart, Sparkles, Sun, Moon, Cake,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  format, startOfMonth, endOfMonth, differenceInDays, startOfWeek, endOfWeek,
  eachDayOfInterval, isToday, subMonths, addMonths
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { HealthScoreTab } from "./HealthScoreTab";
import { MonthlyAnalysisSection } from "./MonthlyAnalysisSection";
import { useAgendaSpecialDates, type SpecialDate } from "@/features/agenda/hooks/use-agenda-dates";
import { getIconById } from "@/features/agenda/components/IconPicker";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

const SQUAD_COLOR_PALETTE = [
  "#7C5CFF", "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#EC4899", "#8B5CF6", "#06B6D4", "#F97316",
];

const SQUAD_ICON_OPTIONS = [
  { id: "shield", icon: Shield, label: "Escudo" },
  { id: "sword", icon: Sword, label: "Espada" },
  { id: "crown", icon: Crown, label: "Coroa" },
  { id: "flame", icon: Flame, label: "Chama" },
  { id: "zap", icon: Zap, label: "Raio" },
  { id: "rocket", icon: Rocket, label: "Foguete" },
  { id: "diamond", icon: Diamond, label: "Diamante" },
  { id: "award", icon: Award, label: "Prêmio" },
  { id: "trophy", icon: Trophy, label: "Troféu" },
  { id: "star", icon: Star, label: "Estrela" },
  { id: "heart", icon: Heart, label: "Coração" },
  { id: "sparkles", icon: Sparkles, label: "Brilhos" },
];

function getSquadIcon(iconId: string) {
  return SQUAD_ICON_OPTIONS.find((i) => i.id === iconId)?.icon ?? Shield;
}

// Holidays are now provided by useAgendaSpecialDates

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={cn("opacity-0", className)} style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

// Table sort
type SortKey = "name" | "contas" | "time" | "health" | "demandas" | "concluidas" | "progresso";
type SortDir = "asc" | "desc";

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
  const [newIcon, setNewIcon] = useState("shield");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showHealthScore, setShowHealthScore] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [holidayFilter, setHolidayFilter] = useState<"all" | "feriados" | "internas" | "aniversarios">("all");

  // Table sort
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Edit squad dialog
  const [editSquad, setEditSquad] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#7C5CFF");
  const [editLeader, setEditLeader] = useState<string>("");
  const [editIcon, setEditIcon] = useState("shield");

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
        .select("id, assignee_id, status_global, stage_current, due_date, client_id, title, updated_at")
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

  const clientsPerSquad = useMemo(() => {
    const m: Record<string, string[]> = {};
    allClientSquads.forEach((cs: any) => {
      if (!m[cs.squad_id]) m[cs.squad_id] = [];
      m[cs.squad_id].push(cs.client_id);
    });
    return m;
  }, [allClientSquads]);

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

  const chartData = useMemo(() => {
    return squads.map((sq: any) => ({
      name: sq.name,
      contas: (clientsPerSquad[sq.id] ?? []).length,
    }));
  }, [squads, clientsPerSquad]);

  // Squad delivery speed data
  const squadSpeedData = useMemo(() => {
    return squads.map((sq: any) => {
      const memberIds = allSquadMembers.filter((sm: any) => sm.squad_id === sq.id).map((sm: any) => sm.user_id);
      const doneTasks = allTasks.filter((t: any) => t.assignee_id && memberIds.includes(t.assignee_id) && t.status_global === "concluido");

      if (doneTasks.length === 0) {
        return { name: sq.name, color: sq.color, icon: sq.icon ?? "shield", speed: 0, totalTarefas: 0, avgDaysBeforeMagic: 0, hasData: false };
      }

      let weightedSum = 0;
      let totalDaysBefore = 0;
      for (const t of doneTasks) {
        const day = new Date(t.updated_at).getDate();
        if (day <= 10) weightedSum += 1.0;
        else if (day <= 20) weightedSum += 0.6;
        else if (day <= 27) weightedSum += 0.3;
        totalDaysBefore += Math.max(0, 27 - day);
      }
      const speed = Math.round((weightedSum / doneTasks.length) * 100);
      const avgDaysBeforeMagic = Math.round(totalDaysBefore / doneTasks.length);

      return { name: sq.name, color: sq.color, icon: sq.icon ?? "shield", speed, totalTarefas: doneTasks.length, avgDaysBeforeMagic, hasData: true };
    }).sort((a, b) => b.speed - a.speed);
  }, [squads, allSquadMembers, allTasks]);

  const bestSquad = useMemo(() => {
    const active = squadSpeedData.filter(s => s.hasData);
    return active.length > 0 ? active[0] : null;
  }, [squadSpeedData]);

  // Table rows with all metrics
  const tableRows = useMemo(() => {
    return squads.map((sq: any) => {
      const st = squadStats[sq.id] ?? { total: 0, done: 0, inProgress: 0, overdue: 0, memberIds: [], clientCount: 0 };
      const clientIds = clientsPerSquad[sq.id] ?? [];
      const healthVals = clientIds.map((c: string) => healthAvgMap[c]).filter((v) => v !== undefined);
      const avgHealth = healthVals.length > 0 ? Math.round(healthVals.reduce((a, b) => a + b, 0) / healthVals.length) : null;
      const members = st.memberIds.map((uid: string) => teamMap[uid]).filter(Boolean);
      const progress = st.total > 0 ? Math.round((st.done / st.total) * 100) : 0;
      return {
        id: sq.id,
        name: sq.name,
        color: sq.color,
        contas: st.clientCount,
        time: members.length,
        health: avgHealth,
        demandas: st.total,
        concluidas: st.done,
        progresso: progress,
      };
    });
  }, [squads, squadStats, clientsPerSquad, healthAvgMap, teamMap]);

  const sortedTableRows = useMemo(() => {
    return [...tableRows].sort((a, b) => {
      const valA = a[sortKey] ?? -1;
      const valB = b[sortKey] ?? -1;
      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === "asc" ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [tableRows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleCreate = () => {
    if (!newName.trim() || !user) return;
    createSquad.mutate({ name: newName.trim(), color: newColor, userId: user.id, leaderId: newLeader || undefined, icon: newIcon }, {
      onSuccess: () => { setCreateOpen(false); setNewName(""); setNewLeader(""); setNewIcon("shield"); },
    });
  };

  const openEdit = (sq: any) => {
    const memberIds = allSquadMembers.filter((sm: any) => sm.squad_id === sq.id).map((sm: any) => sm.user_id);
    setSelectedUsers(memberIds);
    setEditSquad(sq);
    setEditName(sq.name);
    setEditColor(sq.color);
    setEditLeader(sq.leader_id ?? "");
    setEditIcon(sq.icon ?? "shield");
  };

  const saveEdit = () => {
    if (!editSquad || !editName.trim()) return;
    updateSquad.mutate({ id: editSquad.id, name: editName.trim(), color: editColor, leaderId: editLeader || null, icon: editIcon });
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

  // Special dates (holidays, birthdays, internal dates) via unified hook
  const specialDatesMap = useAgendaSpecialDates(
    calMonth.getFullYear(),
    calMonth.getMonth() + 1,
    allTeam.map(m => ({ user_id: m.user_id, display_name: m.display_name, birth_date: m.birth_date }))
  );

  // Build flat list for "Próximas datas" sidebar
  const filteredDates = useMemo(() => {
    const entries: Array<{ date: string; name: string; type: string; icon?: string; color?: string }> = [];
    specialDatesMap.forEach((dates, key) => {
      for (const sd of dates) {
        entries.push({
          date: key,
          name: sd.type === "birthday" ? `🎂 ${sd.personName}` : sd.label,
          type: sd.type === "birthday" ? "Aniversário" : sd.type === "holiday" ? "Feriado Nacional" : "Data Interna",
          icon: sd.icon,
          color: sd.color,
        });
      }
    });
    return entries
      .filter(e => {
        if (new Date(e.date + "T12:00:00") < now) return false;
        if (holidayFilter === "all") return true;
        if (holidayFilter === "feriados") return e.type === "Feriado Nacional";
        if (holidayFilter === "internas") return e.type === "Data Interna";
        if (holidayFilter === "aniversarios") return e.type === "Aniversário";
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [specialDatesMap, holidayFilter, now]);

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

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <button
      onClick={() => handleSort(col)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
    >
      {label}
      <ChevronsUpDown className={cn("h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity", sortKey === col && "opacity-100 text-sidebar")} />
    </button>
  );

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
        <div className="flex flex-wrap gap-4">
          {squads.map((sq: any) => {
            const st = squadStats[sq.id] ?? { total: 0, done: 0, inProgress: 0, overdue: 0, memberIds: [], clientCount: 0 };
            const progress = st.total > 0 ? Math.round((st.done / st.total) * 100) : 0;
            const clientIds = clientsPerSquad[sq.id] ?? [];
            const healthVals = clientIds.map((c: string) => healthAvgMap[c]).filter((v) => v !== undefined);
            const avgHealth = healthVals.length > 0 ? Math.round(healthVals.reduce((a, b) => a + b, 0) / healthVals.length) : 0;
            const healthColor = avgHealth >= 80 ? "text-white" : avgHealth >= 50 ? "text-white" : "text-white/80";
            const members = st.memberIds.map((uid: string) => teamMap[uid]).filter(Boolean);
            const SquadIcon = getSquadIcon(sq.icon ?? "shield");

            return (
              <Card
                key={sq.id}
                className="relative overflow-hidden border-0 group transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl flex-1 min-w-[280px] max-w-[400px]"
                style={{
                  background: `linear-gradient(135deg, ${sq.color} 0%, ${sq.color}dd 50%, ${sq.color}aa 100%)`,
                }}
              >
                {/* Shine effect overlay */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: "linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.15) 60%, transparent 80%)",
                    transform: "translateX(-100%)",
                    animation: "none",
                  }}
                />
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none"
                  style={{
                    background: "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.08) 75%, transparent 100%)",
                    backgroundSize: "200% 100%",
                    animation: "shine 1.5s ease-in-out infinite",
                  }}
                />
                {/* Glow effect on hover */}
                <div
                  className="absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-60 blur-xl transition-opacity duration-500 pointer-events-none -z-10"
                  style={{ backgroundColor: sq.color }}
                />

                <CardContent className="relative py-5 px-5 space-y-4 z-10">
                  {/* Header with dynamic icon */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur-sm">
                        <SquadIcon className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-base font-semibold text-white">{sq.name}</span>
                    </div>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                            <MoreHorizontal className="h-4 w-4 text-white" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(sq)}><Settings2 className="h-4 w-4 mr-2" /> Editar Squad</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteSquad.mutate(sq.id)}><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Members avatars */}
                  <div className="flex -space-x-2">
                    {members.slice(0, 6).map((m: any) => (
                      <Avatar key={m.user_id} className="h-8 w-8 border-2 border-white/30">
                        <AvatarImage src={m.avatar_url ?? undefined} alt={m.display_name} />
                        <AvatarFallback className="text-[10px] bg-white/20 text-white">{initials(m.display_name)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {members.length > 6 && (
                      <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-white/30 bg-white/20 text-white text-[10px] font-medium">
                        +{members.length - 6}
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-white/80">
                      <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Progresso • <Clock className="h-3 w-3" /> {daysLeft} dias restantes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white/90 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-white">{progress}%</span>
                    </div>
                  </div>

                  {/* Health Score */}
                  <div className={cn("text-sm font-medium flex items-center gap-1.5", healthColor)}>
                    <span className={cn("h-2 w-2 rounded-full", avgHealth >= 80 ? "bg-emerald-300" : avgHealth >= 50 ? "bg-amber-300" : avgHealth > 0 ? "bg-rose-300" : "bg-white/40")} />
                    <span className="font-bold">{avgHealth > 0 ? avgHealth : "—"}</span>
                    <span>Health Score</span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs text-white/70 pt-1 border-t border-white/20">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {members.length}</span>
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {st.clientCount}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {st.total}</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> {st.done}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add squad card - always at end */}
          {isAdmin && (
            <Card 
              className="border-dashed cursor-pointer hover:border-primary/40 transition-colors flex-shrink-0 w-[160px]" 
              onClick={() => { setNewName(""); setNewColor("#7C5CFF"); setNewLeader(""); setNewIcon("shield"); setCreateOpen(true); }}
            >
              <CardContent className="flex flex-col items-center justify-center py-10 px-5 gap-2 h-full min-h-[200px]">
                <Plus className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Criar Squad</span>
              </CardContent>
            </Card>
          )}
        </div>
      </FadeUp>


      {/* Progresso das entregas por squad — table widget */}
      <FadeUp delay={0.45}>
        <Card>
          <CardContent className="py-6 px-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-sidebar/10 flex items-center justify-center">
                <BarChart2 className="h-6 w-6 text-sidebar" />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">Progresso das entregas por squad</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{squads.length} squads ativos</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left"><SortHeader label="Squad" col="name" /></th>
                    <th className="px-4 py-3 text-center"><SortHeader label="Contas" col="contas" /></th>
                    <th className="px-4 py-3 text-center"><SortHeader label="Time" col="time" /></th>
                    <th className="px-4 py-3 text-center"><SortHeader label="Health Score" col="health" /></th>
                    <th className="px-4 py-3 text-center"><SortHeader label="Demandas" col="demandas" /></th>
                    <th className="px-4 py-3 text-center"><SortHeader label="Concluídas" col="concluidas" /></th>
                    <th className="px-4 py-3 text-right pr-6"><SortHeader label="Progresso" col="progresso" /></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTableRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">Nenhum squad encontrado</td>
                    </tr>
                  )}
                  {sortedTableRows.map((row, idx) => {
                    const healthColor =
                      row.health === null ? "text-muted-foreground" :
                      row.health >= 80 ? "text-success border-success/40 bg-success/10" :
                      row.health >= 50 ? "text-warning border-warning/40 bg-warning/10" :
                      "text-destructive border-destructive/40 bg-destructive/10";

                    const progressColor =
                      row.progresso === 0 ? "bg-destructive/70" :
                      row.progresso < 50 ? "bg-warning" :
                      "bg-success";

                    const progressBadgeColor =
                      row.progresso === 0 ? "bg-destructive/10 text-destructive" :
                      row.progresso < 50 ? "bg-warning/10 text-warning" :
                      "bg-success/10 text-success";

                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b border-border last:border-0 transition-colors hover:bg-muted/30",
                          idx % 2 === 1 && "bg-muted/10"
                        )}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                            <span className="font-medium text-foreground">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center text-muted-foreground">{row.contas}</td>
                        <td className="px-4 py-3.5 text-center text-muted-foreground">{row.time}</td>
                        <td className="px-4 py-3.5 text-center">
                          {row.health !== null ? (
                            <span className={cn("inline-flex items-center justify-center h-7 w-10 rounded-full border text-xs font-bold", healthColor)}>
                              {row.health}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center text-muted-foreground">{row.demandas}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={cn("font-semibold", row.concluidas > 0 ? "text-success" : "text-muted-foreground")}>
                            {row.concluidas}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 pr-6">
                          <div className="flex items-center gap-2.5 justify-end">
                            <div className="flex-1 max-w-[120px] h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", progressColor)}
                                style={{ width: `${row.progresso}%` }}
                              />
                            </div>
                            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-md min-w-[36px] text-center", progressBadgeColor)}>
                              {row.progresso}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </FadeUp>

      {/* Squad delivery speed chart */}
      {squadSpeedData.length > 0 && (
        <FadeUp delay={0.52}>
          <Card>
            <CardContent className="py-6 px-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-sidebar/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-sidebar" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">Desempenho por Squad</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">Velocidade de entrega das tarefas no mês atual</p>
                </div>
              </div>

              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={squadSpeedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} layout="horizontal">
                    <defs>
                      <linearGradient id="squadBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--sidebar))" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="hsl(var(--sidebar))" stopOpacity={0.35} />
                      </linearGradient>
                      <linearGradient id="squadBarBestGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.45} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (active && payload?.length) {
                          const d = payload[0].payload;
                          if (!d.hasData) return null;
                          return (
                            <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-0.5">
                              <p className="font-semibold text-foreground flex items-center gap-1">
                                {d.name}
                                {bestSquad && d.name === bestSquad.name && (
                                  <Trophy className="h-3 w-3 text-sidebar" />
                                )}
                              </p>
                              <p className="text-muted-foreground">Velocidade: <strong className="text-foreground">{d.speed}%</strong></p>
                              <p className="text-muted-foreground">Tarefas concluídas: <strong className="text-foreground">{d.totalTarefas}</strong></p>
                              <p className="text-muted-foreground">Média dias antes do Magic: <strong className="text-foreground">{d.avgDaysBeforeMagic}</strong></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="speed" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {squadSpeedData.map((entry, index) => {
                        const { Cell: RCell } = require("recharts");
                        return (
                          <RCell
                            key={index}
                            fill={
                              !entry.hasData
                                ? "hsl(var(--muted))"
                                : bestSquad && entry.name === bestSquad.name
                                  ? "url(#squadBarBestGrad)"
                                  : "url(#squadBarGrad)"
                            }
                            fillOpacity={entry.hasData ? 1 : 0.3}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Ranking */}
              {squadSpeedData.filter(s => s.hasData).length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ranking de Velocidade</p>
                  {squadSpeedData.filter(s => s.hasData).map((sq, i) => {
                    const SquadIcon = getSquadIcon(sq.icon);
                    return (
                      <div key={sq.name} className="flex items-center gap-3 text-xs py-1.5">
                        <span className={cn(
                          "font-bold tabular-nums w-5 text-center",
                          i === 0 ? "text-sidebar" : "text-muted-foreground"
                        )}>
                          {i + 1}º
                        </span>
                        <div className="h-5 w-5 rounded flex items-center justify-center" style={{ backgroundColor: sq.color + "20" }}>
                          <SquadIcon className="h-3 w-3" style={{ color: sq.color }} />
                        </div>
                        <span className={cn("font-medium", i === 0 ? "text-foreground" : "text-muted-foreground")}>{sq.name}</span>
                        {i === 0 && <Trophy className="h-3.5 w-3.5 text-sidebar" />}
                        <span className="ml-auto font-bold tabular-nums" style={{ color: i === 0 ? "hsl(142, 71%, 45%)" : undefined }}>
                          {sq.speed}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeUp>
      )}

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
                  const daySpecial = specialDatesMap.get(key) ?? [];
                  const hasHoliday = daySpecial.some(s => s.type === "holiday");
                  const hasBirthday = daySpecial.some(s => s.type === "birthday");
                  const hasInternal = daySpecial.some(s => s.type === "internal");
                  return (
                    <div
                      key={key}
                      className={cn(
                        "relative flex flex-col items-start rounded-lg p-1.5 text-xs transition-all min-h-[52px]",
                        !inMonth && "opacity-30",
                        today && "bg-sidebar text-sidebar-foreground font-bold shadow-md",
                      )}
                    >
                      <span className="text-center w-full">{format(d, "d")}</span>
                      {daySpecial.length > 0 && (
                        <div className="flex flex-col gap-0.5 mt-0.5 w-full">
                          {daySpecial.map((sd, i) => {
                            const isBirthday = sd.type === "birthday";
                            const isHoliday = sd.type === "holiday";
                            const IconComp = isBirthday ? Cake : sd.icon ? getIconById(sd.icon) : Star;
                            const label = isBirthday ? sd.personName : sd.label;
                            const color = isBirthday ? "hsl(var(--warning))" : isHoliday ? "hsl(var(--primary))" : (sd.color ?? "hsl(var(--accent-foreground))");
                            return (
                              <div key={i} className="flex items-center gap-0.5 w-full rounded-md bg-background/80 border border-border/10 px-1 py-0.5 opacity-50" title={label}>
                                <IconComp className="h-2 w-2 shrink-0" style={{ color }} />
                                <span className="text-[6px] font-medium truncate" style={{ color }}>{label}</span>
                              </div>
                            );
                          })}
                        </div>
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
                  <TabsTrigger value="all" className="h-7 rounded-full text-[10px] data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-md flex-1 transition-all px-2">Todas</TabsTrigger>
                  <TabsTrigger value="feriados" className="h-7 rounded-full text-[10px] data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-md flex-1 transition-all px-2">Feriados</TabsTrigger>
                  <TabsTrigger value="internas" className="h-7 rounded-full text-[10px] data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-md flex-1 transition-all px-2">Internas</TabsTrigger>
                  <TabsTrigger value="aniversarios" className="h-7 rounded-full text-[10px] data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-md flex-1 transition-all px-2">Aniv.</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {filteredDates.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma data próxima</p>
                )}
{filteredDates.slice(0, 10).map((h, idx) => (
                  <div key={`${h.date}-${idx}`} className="flex items-start gap-3 rounded-xl border border-border/15 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
                    <div
                      className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-muted/40")}
                      style={h.type === "Data Interna" && h.color ? { backgroundColor: h.color + "15" } : undefined}
                    >
                      {h.type === "Aniversário" ? <Cake className="h-3.5 w-3.5 text-warning/70" /> : h.type === "Data Interna" && h.icon ? (() => { const IC = getIconById(h.icon); return <IC className="h-3.5 w-3.5" style={{ color: h.color }} />; })() : <Star className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{h.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">{format(new Date(h.date + "T12:00:00"), "d 'de' MMMM", { locale: ptBR })}</span>
                        <span className="text-[10px] text-muted-foreground/50">{h.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeUp>

      {/* Análise Mensal da Operação */}
      <FadeUp delay={0.7}>
        <MonthlyAnalysisSection />
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

      {/* Create squad dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle>Criar Squad</DialogTitle>
            <DialogDescription>Defina o nome, cor, ícone e líder do squad.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[60vh]">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input placeholder="Nome do squad" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Cor</label>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {SQUAD_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn("h-9 w-9 rounded-full transition-all flex-shrink-0", newColor === c ? "ring-2 ring-offset-2 ring-foreground" : "")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Ícone</label>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {SQUAD_ICON_OPTIONS.map((opt) => {
                  const IconComp = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setNewIcon(opt.id)}
                      className={cn(
                        "h-9 w-9 rounded-xl transition-all flex-shrink-0 flex items-center justify-center border",
                        newIcon === opt.id 
                          ? "ring-2 ring-offset-2 ring-foreground border-foreground bg-muted" 
                          : "border-border hover:bg-muted/50"
                      )}
                      title={opt.label}
                    >
                      <IconComp className="h-4 w-4 text-foreground" />
                    </button>
                  );
                })}
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
        <DialogContent className="max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle>Editar Squad</DialogTitle>
            <DialogDescription>Altere os dados do squad.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[60vh]">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Cor</label>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {SQUAD_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={cn("h-9 w-9 rounded-full transition-all flex-shrink-0", editColor === c ? "ring-2 ring-offset-2 ring-foreground" : "")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Ícone</label>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {SQUAD_ICON_OPTIONS.map((opt) => {
                  const IconComp = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setEditIcon(opt.id)}
                      className={cn(
                        "h-9 w-9 rounded-xl transition-all flex-shrink-0 flex items-center justify-center border",
                        editIcon === opt.id 
                          ? "ring-2 ring-offset-2 ring-foreground border-foreground bg-muted" 
                          : "border-border hover:bg-muted/50"
                      )}
                      title={opt.label}
                    >
                      <IconComp className="h-4 w-4 text-foreground" />
                    </button>
                  );
                })}
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

      {/* Keyframes for shine animation */}
      <style>{`
        @keyframes shine {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
