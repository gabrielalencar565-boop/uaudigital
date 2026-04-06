import { useMemo, useState, useCallback } from "react";
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
import { useTeamMembers } from "@/features/data/queries";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Trash2, Settings2, Users, CheckCircle2, Clock, FileText,
  MoreHorizontal, CalendarDays, HeartPulse, Target, ChevronLeft, ChevronRight, Star, Shield,
  BarChart2, ChevronsUpDown, Sword, Crown, Flame, Zap, Rocket, Diamond, Award, Trophy,
  Heart, Sparkles, Sun, Moon, Cake, TrendingUp, TrendingDown, Minus, ArrowLeft, AlertTriangle, Lightbulb,
} from "lucide-react";
import { SquadDashboardDialog } from "./SquadDashboardDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  format, startOfMonth, endOfMonth, differenceInDays, startOfWeek, endOfWeek,
  eachDayOfInterval, isToday, subMonths, addMonths, getDaysInMonth
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell, AreaChart, Area } from "recharts";
import { HealthScoreTab } from "./HealthScoreTab";
import { MonthlyAnalysisSection } from "./MonthlyAnalysisSection";
import { ChurnRiskModule } from "./ChurnRiskModule";


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
  const [expandedSquadId, setExpandedSquadId] = useState<string | null>(null);
  const [squadDashTab, setSquadDashTab] = useState<"pipeline" | "ranking" | "progresso">("pipeline");

  // Table sort
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Edit squad dialog
  const [editSquad, setEditSquad] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#7C5CFF");
  const [editLeader, setEditLeader] = useState<string>("");
  const [editIcon, setEditIcon] = useState("shield");

  const teamQ = useTeamMembers();

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  // Magic Number deadline is day 27
  const magicDeadline = new Date(now.getFullYear(), now.getMonth(), 27);
  const magicDaysLeft = Math.max(0, differenceInDays(magicDeadline, now));

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

  // Agenda tasks (tasks table) for current month — used for member productivity
  const agendaTasksQ = useQuery({
    queryKey: ["agenda_tasks_overview", monthStart],
    queryFn: async () => {
      const { data } = await supabase.from("tasks")
        .select("id, assigned_user_id, stage, status, due_date, client_id, completed_at, is_extra_demand, quantity")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .is("deleted_at", null);
      return data ?? [];
    },
  });

  // Fetch active client IDs to filter charts correctly
  const activeClientsQ = useQuery({
    queryKey: ["active_client_ids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("is_active", true)
        .eq("is_freelancer_sentinel", false);
      return new Set((data ?? []).map((c: any) => c.id));
    },
  });
  const activeClientIds = activeClientsQ.data ?? new Set<string>();

  // Fetch Magic Number stages for current AND previous month (for squad speed + comparison)
  const magic2StagesQ = useQuery({
    queryKey: ["magic2_squad_speed_v2", now.getFullYear(), now.getMonth() + 1],
    queryFn: async () => {
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const prevDate = subMonths(now, 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth() + 1;

      // Get cycles for both months
      const { data: allCycles } = await supabase
        .from("magic2_cycles")
        .select("id, client_id, year, month")
        .eq("is_active", true)
        .or(`and(year.eq.${year},month.eq.${month}),and(year.eq.${prevYear},month.eq.${prevMonth})`);

      if (!allCycles?.length) return { stages: [] as any[], prevStages: [] as any[], clientNames: {} as Record<string, string> };

      const currentCycles = allCycles.filter(c => c.year === year && c.month === month);
      const prevCycles = allCycles.filter(c => c.year === prevYear && c.month === prevMonth);

      const allCycleIds = allCycles.map(c => c.id);
      const { data: allStages } = await supabase
        .from("magic2_cycle_stages")
        .select("id, cycle_id, stage, completed, completed_at")
        .in("cycle_id", allCycleIds);

      // Get magic2_client_links
      const magic2ClientIds = [...new Set(allCycles.map(c => c.client_id))];
      const { data: links } = await supabase
        .from("magic2_client_links")
        .select("magic2_client_id, agenda_client_id")
        .in("magic2_client_id", magic2ClientIds);

      // Get client names
      const { data: m2Clients } = await supabase
        .from("magic2_clients")
        .select("id, name")
        .in("id", magic2ClientIds);

      const clientNameMap: Record<string, string> = {};
      (m2Clients ?? []).forEach((c: any) => { clientNameMap[c.id] = c.name; });

      // Build maps
      const m2ToAgenda: Record<string, string> = {};
      (links ?? []).forEach((l: any) => { m2ToAgenda[l.magic2_client_id] = l.agenda_client_id; });

      const buildStageList = (cycles: typeof allCycles, stages: typeof allStages) => {
        const cycleToAgenda: Record<string, string> = {};
        const cycleToM2Client: Record<string, string> = {};
        cycles.forEach((c: any) => {
          if (m2ToAgenda[c.client_id]) cycleToAgenda[c.id] = m2ToAgenda[c.client_id];
          cycleToM2Client[c.id] = c.client_id;
        });
        const cycleIds = new Set(cycles.map(c => c.id));
        return (stages ?? [])
          .filter((s: any) => cycleIds.has(s.cycle_id))
          .map((s: any) => ({
            ...s,
            agenda_client_id: cycleToAgenda[s.cycle_id] ?? null,
            client_name: clientNameMap[cycleToM2Client[s.cycle_id]] ?? "—",
          }));
      };

      return {
        stages: buildStageList(currentCycles, allStages ?? []),
        prevStages: buildStageList(prevCycles, allStages ?? []),
        clientNames: clientNameMap,
      };
    },
  });

  const healthQ = useHealthScores(now.getMonth() + 1, now.getFullYear());

  const squads = squadsQ.data ?? [];
  const allSquadMembers = membersQ.data ?? [];
  const allClientSquads = clientSquadsQ.data ?? [];
  const allTeam = teamQ.data ?? [];
  const allTasks = pmTasksQ.data ?? [];
  const agendaTasks = agendaTasksQ.data ?? [];
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

  // Only include active clients in squad mapping
  const clientsPerSquad = useMemo(() => {
    const m: Record<string, string[]> = {};
    allClientSquads.forEach((cs: any) => {
      if (!activeClientIds.has(cs.client_id)) return; // skip inactive clients
      if (!m[cs.squad_id]) m[cs.squad_id] = [];
      m[cs.squad_id].push(cs.client_id);
    });
    return m;
  }, [allClientSquads, activeClientIds]);

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

  // Filter magic2 stages to only include active clients
  const magic2AllStages = useMemo(() => {
    return (magic2StagesQ.data?.stages ?? []).filter((s: any) => s.agenda_client_id && activeClientIds.has(s.agenda_client_id));
  }, [magic2StagesQ.data?.stages, activeClientIds]);
  const magic2PrevStages = useMemo(() => {
    return (magic2StagesQ.data?.prevStages ?? []).filter((s: any) => s.agenda_client_id && activeClientIds.has(s.agenda_client_id));
  }, [magic2StagesQ.data?.prevStages, activeClientIds]);
  const magic2Stages = magic2AllStages.filter((s: any) => s.completed);

  const STAGE_ORDER = ["planejamento", "captacao", "edicao_videos", "design", "pdf", "alteracoes", "agendamento"] as const;
  const STAGE_LABELS: Record<string, string> = {
    planejamento: "Planejamento", captacao: "Captação", edicao_videos: "Vídeo",
    design: "Design", pdf: "PDF", alteracoes: "Alterações", agendamento: "Agendamento",
  };

  const computeSpeed = (stages: any[]) => {
    if (stages.length === 0) return { speed: 0, avgDays: 0 };
    let weightedSum = 0;
    let totalDaysBefore = 0;
    for (const s of stages) {
      const day = new Date(s.completed_at).getDate();
      if (day <= 10) weightedSum += 1.0;
      else if (day <= 20) weightedSum += 0.6;
      else if (day <= 27) weightedSum += 0.3;
      totalDaysBefore += Math.max(0, 27 - day);
    }
    return { speed: Math.round((weightedSum / stages.length) * 100), avgDays: Math.round(totalDaysBefore / stages.length) };
  };

  // Squad delivery speed data based on Magic Number completed stages
  const squadSpeedData = useMemo(() => {
    return squads.map((sq: any) => {
      const squadClientIds = (clientsPerSquad[sq.id] ?? []);
      const squadStages = magic2Stages.filter((s: any) => s.agenda_client_id && squadClientIds.includes(s.agenda_client_id));
      const prevSquadStages = magic2PrevStages.filter((s: any) => s.completed && s.agenda_client_id && squadClientIds.includes(s.agenda_client_id));

      const { speed, avgDays } = computeSpeed(squadStages);
      const { speed: prevSpeed } = computeSpeed(prevSquadStages);

      const totalEtapas = squadClientIds.length * STAGE_ORDER.length;
      const completedEtapas = squadStages.length;

      if (squadClientIds.length === 0) {
        return { id: sq.id, name: sq.name, color: sq.color, icon: sq.icon ?? "shield", speed: 0, totalTarefas: 0, avgDaysBeforeMagic: 0, hasData: false, prevSpeed: 0, totalEtapas: 0, completedEtapas: 0, percentComplete: 0 };
      }

      return {
        id: sq.id, name: sq.name, color: sq.color, icon: sq.icon ?? "shield",
        speed, totalTarefas: completedEtapas, avgDaysBeforeMagic: avgDays, hasData: true,
        prevSpeed, totalEtapas, completedEtapas, percentComplete: totalEtapas > 0 ? Math.round((completedEtapas / totalEtapas) * 100) : 0,
      };
    }).sort((a, b) => b.speed - a.speed);
  }, [squads, clientsPerSquad, magic2Stages, magic2PrevStages]);

  const bestSquad = useMemo(() => {
    const active = squadSpeedData.filter(s => s.hasData);
    return active.length > 0 ? active[0] : null;
  }, [squadSpeedData]);

  // Pipeline data: how many clients are "at" each stage (last completed stage)
  const pipelineData = useMemo(() => {
    // For each client with stages, find the last completed stage (or "not started")
    const clientMap: Record<string, { stages: any[] }> = {};
    for (const s of magic2AllStages) {
      if (!s.agenda_client_id) continue;
      if (!clientMap[s.agenda_client_id]) clientMap[s.agenda_client_id] = { stages: [] };
      clientMap[s.agenda_client_id].stages.push(s);
    }

    const stageCounts: Record<string, number> = {};
    STAGE_ORDER.forEach(k => { stageCounts[k] = 0; });

    for (const [, data] of Object.entries(clientMap)) {
      const completedStages = data.stages.filter((s: any) => s.completed).map((s: any) => s.stage);
      // Count clients that have NOT completed each stage (i.e., still pending at that stage)
      for (const stageKey of STAGE_ORDER) {
        if (!completedStages.includes(stageKey)) {
          stageCounts[stageKey]++;
        }
      }
    }

    return STAGE_ORDER.map(k => ({
      stage: k,
      label: STAGE_LABELS[k],
      pending: stageCounts[k],
      total: Object.keys(clientMap).length,
    }));
  }, [magic2AllStages]);

  // Heatmap data: squad × stage completion percentage
  const heatmapData = useMemo(() => {
    return squads.map((sq: any) => {
      const squadClientIds = clientsPerSquad[sq.id] ?? [];
      const squadClientSet = new Set(squadClientIds);
      const squadAllSt = magic2AllStages.filter((s: any) => s.agenda_client_id && squadClientSet.has(s.agenda_client_id));

      const stagePerf: Record<string, { completed: number; total: number; percent: number }> = {};
      for (const stageKey of STAGE_ORDER) {
        const completedClients = new Set(
          squadAllSt
            .filter((s: any) => s.stage === stageKey && s.completed && s.agenda_client_id)
            .map((s: any) => s.agenda_client_id),
        );

        const completed = completedClients.size;
        const total = squadClientIds.length;
        stagePerf[stageKey] = { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : -1 };
      }

      return { id: sq.id, name: sq.name, color: sq.color, icon: sq.icon ?? "shield", stagePerf };
    });
  }, [squads, clientsPerSquad, magic2AllStages]);

  // Squad progress evolution data (daily % per squad, like the operation progress chart)
  const squadProgressData = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const currentDay = now.getDate();
    const totalDays = getDaysInMonth(now);

    return Array.from({ length: totalDays }, (_, i) => {
      const dia = i + 1;
      const dateStr = format(new Date(year, month - 1, dia), "yyyy-MM-dd");
      const row: Record<string, any> = { dia };

      squads.forEach((sq: any) => {
        const squadClientIds = clientsPerSquad[sq.id] ?? [];
        const totalEtapas = squadClientIds.length * STAGE_ORDER.length;
        if (totalEtapas === 0 || dia > currentDay) {
          row[sq.id] = undefined;
          return;
        }
        const doneUpToDay = magic2AllStages.filter((s: any) =>
          s.agenda_client_id && squadClientIds.includes(s.agenda_client_id) &&
          s.completed && s.completed_at && s.completed_at.slice(0, 10) <= dateStr
        ).length;
        row[sq.id] = Math.round((doneUpToDay / totalEtapas) * 100);
      });

      return row;
    });
  }, [squads, clientsPerSquad, magic2AllStages, now]);

  // Per-stage daily progress for the expanded squad
  const expandedSquadStageProgress = useMemo(() => {
    if (!expandedSquadId) return [];
    const squadClientIds = clientsPerSquad[expandedSquadId] ?? [];
    if (squadClientIds.length === 0) return [];
    const totalDays = getDaysInMonth(now);
    const currentDayNum = now.getDate();
    const year = now.getFullYear();
    const monthNum = now.getMonth() + 1;
    const squadStages = magic2AllStages.filter((s: any) => s.agenda_client_id && squadClientIds.includes(s.agenda_client_id));
    const totalClientsForSquad = squadClientIds.length;

    return Array.from({ length: totalDays }, (_, i) => {
      const dia = i + 1;
      if (dia > currentDayNum) {
        const row: Record<string, any> = { dia };
        STAGE_ORDER.forEach(k => { row[k] = undefined; });
        return row;
      }
      const dateStr = format(new Date(year, monthNum - 1, dia), "yyyy-MM-dd");
      const row: Record<string, any> = { dia };
      for (const stageKey of STAGE_ORDER) {
        const doneUpToDay = squadStages.filter((s: any) =>
          s.stage === stageKey && s.completed && s.completed_at && s.completed_at.slice(0, 10) <= dateStr
        ).length;
        row[stageKey] = totalClientsForSquad > 0 ? Math.round((doneUpToDay / totalClientsForSquad) * 100) : 0;
      }
      return row;
    });
  }, [expandedSquadId, clientsPerSquad, magic2AllStages, now]);


  const expandedSquadDetail = useMemo(() => {
    if (!expandedSquadId) return null;
    const sq = squads.find((s: any) => s.id === expandedSquadId);
    if (!sq) return null;
    const squadClientIds = (clientsPerSquad[sq.id] ?? []);
    const squadAllStages = magic2AllStages.filter((s: any) => s.agenda_client_id && squadClientIds.includes(s.agenda_client_id));
    const prevStages = magic2PrevStages.filter((s: any) => s.agenda_client_id && squadClientIds.includes(s.agenda_client_id));

    // Group by client
    const clientMap: Record<string, { name: string; stages: any[]; prevStages: any[] }> = {};
    for (const s of squadAllStages) {
      if (!clientMap[s.agenda_client_id]) clientMap[s.agenda_client_id] = { name: s.client_name, stages: [], prevStages: [] };
      clientMap[s.agenda_client_id].stages.push(s);
    }
    for (const s of prevStages) {
      if (!clientMap[s.agenda_client_id]) clientMap[s.agenda_client_id] = { name: s.client_name, stages: [], prevStages: [] };
      clientMap[s.agenda_client_id].prevStages.push(s);
    }

    const clients = Object.entries(clientMap).map(([clientId, data]) => {
      const completed = data.stages.filter((s: any) => s.completed);
      const total = data.stages.length;
      const percent = total > 0 ? Math.round((completed.length / total) * 100) : 0;
      const prevCompleted = data.prevStages.filter((s: any) => s.completed);
      const prevTotal = data.prevStages.length;
      const prevPercent = prevTotal > 0 ? Math.round((prevCompleted.length / prevTotal) * 100) : 0;
      const { speed } = computeSpeed(completed);
      const { speed: prevSpd } = computeSpeed(prevCompleted);

      // Insights
      const insights: string[] = [];
      if (percent === 100) insights.push("✅ Todas etapas concluídas");
      else if (percent === 0) insights.push("⚠️ Nenhuma etapa iniciada");
      else if (percent < 50 && new Date().getDate() > 15) insights.push("🔴 Atenção: menos da metade concluída na 2ª quinzena");
      if (prevPercent > 0 && percent > prevPercent) insights.push("📈 Melhor que o mês anterior");
      else if (prevPercent > 0 && percent < prevPercent) insights.push("📉 Abaixo do mês anterior");
      const earlyStages = completed.filter((s: any) => new Date(s.completed_at).getDate() <= 10);
      if (earlyStages.length >= 3) insights.push("⚡ Alta proatividade (3+ etapas nos primeiros 10 dias)");

      return {
        clientId, name: data.name, stages: data.stages, completed: completed.length, total, percent,
        prevPercent, speed, prevSpeed: prevSpd, insights,
      };
    }).sort((a, b) => b.percent - a.percent);

    // Squad-level insights
    const sqData = squadSpeedData.find(s => s.id === expandedSquadId);
    const squadInsights: string[] = [];
    if (sqData) {
      const diff = sqData.speed - sqData.prevSpeed;
      if (diff > 10) squadInsights.push(`📈 Velocidade subiu ${diff}% em relação ao mês anterior`);
      else if (diff < -10) squadInsights.push(`📉 Velocidade caiu ${Math.abs(diff)}% em relação ao mês anterior`);
      else if (sqData.prevSpeed > 0) squadInsights.push("➡️ Velocidade estável em relação ao mês anterior");
      const allDone = clients.every(c => c.percent === 100);
      if (allDone) squadInsights.push("🏆 Todos os clientes 100% concluídos!");
      const lagging = clients.filter(c => c.percent < 50 && c.total > 0);
      if (lagging.length > 0) squadInsights.push(`⚠️ ${lagging.length} cliente(s) com menos de 50% das etapas`);
    }

    return { squad: sq, clients, squadInsights, sqData, squadAllStages };
  }, [expandedSquadId, squads, clientsPerSquad, magic2AllStages, magic2PrevStages, squadSpeedData]);

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
            const squadClientIds = clientsPerSquad[sq.id] ?? [];
            const squadCompletedStages = magic2AllStages.filter((s: any) => s.agenda_client_id && squadClientIds.includes(s.agenda_client_id) && s.completed).length;
            const squadTotalStages = squadClientIds.length * STAGE_ORDER.length;
            const progress = squadTotalStages > 0 ? Math.round((squadCompletedStages / squadTotalStages) * 100) : 0;
            const clientIds = clientsPerSquad[sq.id] ?? [];
            const healthVals = clientIds.map((c: string) => healthAvgMap[c]).filter((v) => v !== undefined);
            const avgHealth = healthVals.length > 0 ? Math.round(healthVals.reduce((a, b) => a + b, 0) / healthVals.length) : 0;
            const healthColor = avgHealth >= 80 ? "text-white" : avgHealth >= 50 ? "text-white" : "text-white/80";
            const members = st.memberIds.map((uid: string) => teamMap[uid]).filter(Boolean);
            const SquadIcon = getSquadIcon(sq.icon ?? "shield");

            return (
              <Card
                key={sq.id}
                className="relative overflow-hidden border-0 group transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl flex-1 min-w-[280px] max-w-[400px] cursor-pointer"
                onClick={() => setExpandedSquadId(sq.id)}
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
                          <button onClick={(e) => e.stopPropagation()} className="h-7 w-7 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
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
                      <UserAvatar key={m.user_id} avatarUrl={m.avatar_url} name={m.display_name} className="h-8 w-8 border-2 border-white/30" fallbackClassName="text-[10px] bg-white/20 text-white" />
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
                      <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Progresso • <Clock className="h-3 w-3" /> {magicDaysLeft} dias restantes</span>
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


      {/* ═══ DESEMPENHO POR SQUAD + PROGRESSO DA OPERAÇÃO ═══ */}
      <FadeUp delay={0.5}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Desempenho por Squad */}
          {heatmapData.length > 0 && (
          <Card className="flex flex-col min-h-[580px]">
            <CardContent className="py-6 px-6 space-y-5 flex-1 flex flex-col">
              {/* Header + Tabs */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center">
                    <BarChart2 className="h-5 w-5 text-sidebar" />
                  </div>
                  <div>
                    <p className="text-base font-bold leading-none">Desempenho por Squad</p>
                    <p className="mt-1 text-xs text-muted-foreground">{format(now, "MMMM yyyy", { locale: ptBR })}</p>
                  </div>
                </div>
                <Tabs value={squadDashTab} onValueChange={(v) => setSquadDashTab(v as any)} className="w-auto">
                  <TabsList className="h-9">
                    <TabsTrigger value="pipeline" className="text-xs px-3">Pipeline</TabsTrigger>
                    <TabsTrigger value="ranking" className="text-xs px-3">Ranking</TabsTrigger>
                    <TabsTrigger value="progresso" className="text-xs px-3">Progresso</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Legend (shared) */}
              <div className="flex flex-wrap gap-3">
                {heatmapData.map((sq) => (
                  <div key={sq.id} className="flex items-center gap-1.5 text-xs">
                    <div className="h-3 w-3 rounded-sm" style={{ background: `linear-gradient(135deg, ${sq.color}, ${sq.color}99)` }} />
                    <span className="font-medium text-foreground">{sq.name}</span>
                  </div>
                ))}
              </div>

              {/* ─── ABA: PIPELINE ─── */}
              {squadDashTab === "pipeline" && (
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="h-[300px] w-full flex-1 min-h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={STAGE_ORDER.map(stageKey => {
                          const row: Record<string, any> = { stage: STAGE_LABELS[stageKey] };
                          heatmapData.forEach(sq => {
                            row[sq.id] = sq.stagePerf[stageKey]?.completed ?? 0;
                            row[sq.id + "_total"] = sq.stagePerf[stageKey]?.total ?? 0;
                          });
                          return row;
                        })}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        barGap={2}
                        barCategoryGap="20%"
                      >
                        <defs>
                          {heatmapData.map((sq) => (
                            <linearGradient key={sq.id} id={`grad-${sq.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={sq.color} stopOpacity={1} />
                              <stop offset="100%" stopColor={sq.color} stopOpacity={0.45} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                        <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--accent))", opacity: 0.3 }}
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2.5 space-y-1.5">
                                <p className="text-xs font-bold text-foreground">{label}</p>
                                {payload.map((entry: any) => {
                                  const sq = heatmapData.find(s => s.id === entry.dataKey);
                                  if (!sq) return null;
                                  const total = entry.payload[sq.id + "_total"] ?? 0;
                                  return (
                                    <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
                                      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: `linear-gradient(135deg, ${sq.color}, ${sq.color}99)` }} />
                                      <span className="text-muted-foreground">{sq.name}:</span>
                                      <span className="font-bold text-foreground">{entry.value}/{total} clientes</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }}
                        />
                        {heatmapData.map((sq) => (
                          <Bar key={sq.id} dataKey={sq.id} fill={`url(#grad-${sq.id})`} radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={800} animationBegin={200} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Insight */}
                  {(() => {
                    let worstStage = "";
                    let worstPct = 101;
                    for (const stageKey of STAGE_ORDER) {
                      let totalC = 0, totalT = 0;
                      heatmapData.forEach(sq => {
                        totalC += sq.stagePerf[stageKey]?.completed ?? 0;
                        totalT += sq.stagePerf[stageKey]?.total ?? 0;
                      });
                      const pct = totalT > 0 ? Math.round((totalC / totalT) * 100) : 100;
                      if (pct < worstPct) { worstPct = pct; worstStage = STAGE_LABELS[stageKey]; }
                    }
                    if (worstPct < 100 && worstStage) {
                      return (
                        <div className="flex items-center gap-2 text-xs bg-accent/30 rounded-lg px-3 py-2">
                          <Lightbulb className="h-3.5 w-3.5 text-sidebar shrink-0" />
                          <span className="text-muted-foreground">
                            <strong className="text-foreground">{worstStage}</strong> é a etapa com menor conclusão geral ({worstPct}%). Pode ser um gargalo na operação.
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* ─── ABA: RANKING ─── */}
              {squadDashTab === "ranking" && (
                <div className="space-y-3">
                  {squadSpeedData.filter(s => s.hasData).map((sq, idx) => {
                    const SquadIcon = getSquadIcon(sq.icon);
                    const isFirst = idx === 0;
                    const diff = sq.speed - sq.prevSpeed;
                    const medals = ["🥇", "🥈", "🥉"];
                    const medal = idx < 3 ? medals[idx] : `${idx + 1}º`;

                    let speedLabel = "";
                    let speedTone = "";
                    if (sq.speed >= 80) { speedLabel = "Excepcional"; speedTone = "text-emerald-500"; }
                    else if (sq.speed >= 60) { speedLabel = "Boa velocidade"; speedTone = "text-sky-500"; }
                    else if (sq.speed >= 40) { speedLabel = "Moderada"; speedTone = "text-amber-500"; }
                    else { speedLabel = "Precisa acelerar"; speedTone = "text-rose-500"; }

                    let reason = "";
                    if (sq.speed >= 80) reason = "Maioria das etapas concluídas nos primeiros 10 dias";
                    else if (sq.speed >= 60) reason = "Bom ritmo — etapas sendo fechadas antes do dia 20";
                    else if (sq.speed >= 40) reason = "Entregas concentradas na segunda quinzena";
                    else reason = "Etapas concluídas apenas próximo ao fechamento";

                    const gradientBg = isFirst
                      ? `linear-gradient(135deg, ${sq.color}18 0%, ${sq.color}08 100%)`
                      : undefined;

                    return (
                      <div
                        key={sq.id}
                        className={cn(
                          "relative rounded-xl border p-4 transition-all duration-300",
                          isFirst ? "border-transparent shadow-md" : "border-border/30 hover:border-border/60",
                        )}
                        style={gradientBg ? { background: gradientBg } : undefined}
                      >
                        {isFirst && (
                          <div className="absolute -top-3 right-4 bg-sidebar text-sidebar-foreground text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                            <Trophy className="h-3 w-3" /> Mais ágil
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <span className="text-xl font-bold min-w-[36px] text-center">{medal}</span>
                          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${sq.color}, ${sq.color}aa)` }}>
                            <SquadIcon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">{sq.name}</span>
                              <span className={cn("text-xs font-bold", speedTone)}>{speedLabel}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{reason}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-2xl font-bold text-foreground">{sq.speed}<span className="text-sm font-normal text-muted-foreground">%</span></div>
                            <div className="flex items-center justify-end gap-1 text-xs">
                              {diff > 0 && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                              {diff < 0 && <TrendingDown className="h-3 w-3 text-rose-500" />}
                              {diff === 0 && sq.prevSpeed > 0 && <Minus className="h-3 w-3 text-muted-foreground" />}
                              {sq.prevSpeed > 0 && (
                                <span className={cn("font-medium", diff > 0 ? "text-emerald-500" : diff < 0 ? "text-rose-500" : "text-muted-foreground")}>
                                  {diff > 0 ? "+" : ""}{diff}% vs mês anterior
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-border/20 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sq.speed}%`, background: `linear-gradient(90deg, ${sq.color}, ${sq.color}88)` }} />
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                          <span>{sq.completedEtapas}/{sq.totalEtapas} etapas concluídas</span>
                          <span>{sq.percentComplete}% do ciclo</span>
                          {sq.avgDaysBeforeMagic > 0 && <span>~{sq.avgDaysBeforeMagic}d antes do dia 27</span>}
                        </div>
                      </div>
                    );
                  })}
                  {squadSpeedData.filter(s => s.hasData).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado de agilidade disponível</p>
                  )}
                </div>
              )}

              {/* ─── ABA: PROGRESSO ─── */}
              {squadDashTab === "progresso" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Evolução diária do % de etapas concluídas por squad ao longo do mês</p>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={squadProgressData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          {heatmapData.map((sq) => (
                            <linearGradient key={`area-${sq.id}`} id={`area-grad-${sq.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={sq.color} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={sq.color} stopOpacity={0.02} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                        <XAxis
                          dataKey="dia"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          interval={4}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          width={35}
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2.5 space-y-1.5">
                                <p className="text-xs font-bold text-foreground">Dia {label}</p>
                                {payload
                                  .filter((e: any) => e.value !== undefined)
                                  .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0))
                                  .map((entry: any) => {
                                    const sq = heatmapData.find(s => s.id === entry.dataKey);
                                    if (!sq) return null;
                                    return (
                                      <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
                                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sq.color }} />
                                        <span className="text-muted-foreground">{sq.name}:</span>
                                        <span className="font-bold text-foreground">{entry.value}%</span>
                                      </div>
                                    );
                                  })}
                              </div>
                            );
                          }}
                        />
                        {/* Reference line for day 27 */}
                        {heatmapData.map((sq) => (
                          <Area
                            key={sq.id}
                            type="monotone"
                            dataKey={sq.id}
                            stroke={sq.color}
                            strokeWidth={2.5}
                            fill={`url(#area-grad-${sq.id})`}
                            dot={false}
                            connectNulls={false}
                            animationDuration={800}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Summary per squad */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {squadSpeedData.filter(s => s.hasData).map((sq) => (
                      <div key={sq.id} className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: sq.color }} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{sq.name}</p>
                          <p className="text-[11px] text-muted-foreground">{sq.percentComplete}% concluído</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Progresso da Operação */}
          <MonthlyAnalysisSection className="min-h-[580px]" />
        </div>
      </FadeUp>

      {/* Health Score access */}
      <FadeUp delay={0.65}>
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

      {/* Risco de Churn */}
      <FadeUp delay={0.7}>
        <ChurnRiskModule />
      </FadeUp>



      {/* Squad Dashboard Dialog */}
      {expandedSquadDetail && (
        <SquadDashboardDialog
          open={!!expandedSquadId}
          onClose={() => setExpandedSquadId(null)}
          squad={expandedSquadDetail.squad}
          squadIcon={getSquadIcon(expandedSquadDetail.squad.icon ?? "shield")}
          stageProgress={expandedSquadStageProgress}
          stagePerf={
            heatmapData.find(h => h.id === expandedSquadId)?.stagePerf ?? {}
          }
          clients={expandedSquadDetail.clients}
          squadInsights={expandedSquadDetail.squadInsights}
          sqData={expandedSquadDetail.sqData}
          teamMap={teamMap}
          squadMemberIds={squadStats[expandedSquadId!]?.memberIds ?? []}
          squadStages={expandedSquadDetail.squadAllStages}
          agendaTasks={agendaTasks}
          squadClientIds={clientsPerSquad[expandedSquadId!] ?? []}
        />
      )}

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
                    <UserAvatar avatarUrl={m.avatar_url} name={m.display_name} className="h-6 w-6" fallbackClassName="text-[9px]" />
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
