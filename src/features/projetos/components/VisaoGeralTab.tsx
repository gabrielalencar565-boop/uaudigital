import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSquads, useSquadMembers, useCreateSquad, useDeleteSquad, useUpdateSquadMembers } from "../hooks/use-squads";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { Plus, Trash2, Settings2, Users, CheckCircle2, Clock, AlertTriangle, BarChart3, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

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

  const squads = squadsQ.data ?? [];
  const allSquadMembers = membersQ.data ?? [];
  const allTeam = teamQ.data ?? [];
  const allTasks = pmTasksQ.data ?? [];

  const teamMap = useMemo(() => {
    const m: Record<string, typeof allTeam[0]> = {};
    allTeam.forEach((t) => { m[t.user_id] = t; });
    return m;
  }, [allTeam]);

  // Stats per squad
  const squadStats = useMemo(() => {
    const stats: Record<string, { total: number; done: number; inProgress: number; overdue: number; memberIds: string[] }> = {};
    squads.forEach((sq: any) => {
      const memberIds = allSquadMembers.filter((sm: any) => sm.squad_id === sq.id).map((sm: any) => sm.user_id);
      const tasks = allTasks.filter((t) => t.assignee_id && memberIds.includes(t.assignee_id));
      const done = tasks.filter((t) => t.status_global === "concluido").length;
      const inProgress = tasks.filter((t) => t.status_global === "em_andamento").length;
      const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < now && t.status_global !== "concluido").length;
      stats[sq.id] = { total: tasks.length, done, inProgress, overdue, memberIds };
    });
    return stats;
  }, [squads, allSquadMembers, allTasks]);

  // Global stats
  const globalStats = useMemo(() => {
    const total = allTasks.length;
    const done = allTasks.filter((t) => t.status_global === "concluido").length;
    const inProgress = allTasks.filter((t) => t.status_global === "em_andamento").length;
    const overdue = allTasks.filter((t) => t.due_date && new Date(t.due_date) < now && t.status_global !== "concluido").length;
    const backlog = allTasks.filter((t) => t.status_global === "backlog").length;
    return { total, done, inProgress, overdue, backlog };
  }, [allTasks]);

  // Stage distribution
  const stageDistribution = useMemo(() => {
    const stages: Record<string, number> = {};
    allTasks.forEach((t) => {
      stages[t.stage_current] = (stages[t.stage_current] || 0) + 1;
    });
    return Object.entries(stages).sort((a, b) => b[1] - a[1]);
  }, [allTasks]);

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

  const monthLabel = format(now, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="space-y-6 mt-4">
      {/* Global summary row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard icon={<BarChart3 className="h-4 w-4" />} label="Total" value={globalStats.total} color="text-foreground" />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Concluídas" value={globalStats.done} color="text-green-500" />
        <SummaryCard icon={<Clock className="h-4 w-4" />} label="Em andamento" value={globalStats.inProgress} color="text-blue-500" />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Atrasadas" value={globalStats.overdue} color="text-red-500" />
        <SummaryCard icon={<CalendarDays className="h-4 w-4" />} label="Backlog" value={globalStats.backlog} color="text-muted-foreground" />
      </div>

      {/* Squad cards */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Squads</h2>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo Squad
          </Button>
        )}
      </div>

      {squads.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhum squad criado ainda</p>
            {isAdmin && <Button size="sm" variant="outline" className="mt-3" onClick={() => setCreateOpen(true)}>Criar Squad</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {squads.map((sq: any) => {
            const st = squadStats[sq.id] ?? { total: 0, done: 0, inProgress: 0, overdue: 0, memberIds: [] };
            const progress = st.total > 0 ? Math.round((st.done / st.total) * 100) : 0;
            return (
              <Card key={sq.id} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: sq.color }} />
                <CardHeader className="flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-semibold">{sq.name}</CardTitle>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openConfig(sq)}>
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteSquad.mutate(sq.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Members */}
                  <div className="flex items-center gap-1">
                    {st.memberIds.slice(0, 5).map((uid) => {
                      const m = teamMap[uid];
                      return (
                        <Avatar key={uid} className="h-7 w-7 border-2 border-background -ml-1 first:ml-0">
                          <AvatarImage src={m?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">{initials(m?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>
                      );
                    })}
                    {st.memberIds.length > 5 && (
                      <span className="text-xs text-muted-foreground ml-1">+{st.memberIds.length - 5}</span>
                    )}
                    {st.memberIds.length === 0 && <span className="text-xs text-muted-foreground">Sem membros</span>}
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-4">
                    <ProgressRing value={progress} size={56} stroke={5} />
                    <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-green-500">{st.done}</p>
                        <p className="text-[10px] text-muted-foreground">Feitas</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-500">{st.inProgress}</p>
                        <p className="text-[10px] text-muted-foreground">Fazendo</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-500">{st.overdue}</p>
                        <p className="text-[10px] text-muted-foreground">Atrasadas</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Stage distribution */}
      {stageDistribution.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tarefas por etapa — {monthLabel}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stageDistribution.map(([stage, count]) => {
                const pct = globalStats.total > 0 ? Math.round((count / globalStats.total) * 100) : 0;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 truncate capitalize">{stage.replace(/_/g, " ")}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4 px-4">
        <div className={cn("shrink-0", color)}>{icon}</div>
        <div>
          <p className={cn("text-xl font-bold", color)}>{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
