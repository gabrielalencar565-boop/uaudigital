import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Play, Trophy, Users, Video, AlertTriangle, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_OPTIONS } from "@/lib/role-options";

type XPSettings = {
  rank_1_xp: number;
  rank_2_xp: number;
  squad_destaque_xp: number;
  video_destaque_xp: number;
  task_late_penalty: number;
  video_destaque_roles: string[];
  late_penalize_all_assignees: boolean;
};

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function XPAutomationPanel() {
  return (
    <Tabs defaultValue="config">
      <TabsList>
        <TabsTrigger value="config"><Zap className="h-4 w-4 mr-2" />Configuração</TabsTrigger>
        <TabsTrigger value="video"><Video className="h-4 w-4 mr-2" />Vídeo Destaque</TabsTrigger>
        <TabsTrigger value="exec"><Play className="h-4 w-4 mr-2" />Processar mês</TabsTrigger>
      </TabsList>
      <TabsContent value="config" className="mt-4"><SettingsPanel /></TabsContent>
      <TabsContent value="video" className="mt-4"><VideoDestaquePanel /></TabsContent>
      <TabsContent value="exec" className="mt-4"><ManualRunPanel /></TabsContent>
    </Tabs>
  );
}

// ============ Settings ============
function SettingsPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["xp_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("xp_settings").select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      return data as XPSettings;
    },
  });

  const [local, setLocal] = useState<XPSettings | null>(null);
  const s = local ?? q.data;

  const save = useMutation({
    mutationFn: async () => {
      if (!s) return;
      const { error } = await supabase.from("xp_settings").update({
        rank_1_xp: s.rank_1_xp,
        rank_2_xp: s.rank_2_xp,
        squad_destaque_xp: s.squad_destaque_xp,
        video_destaque_xp: s.video_destaque_xp,
        task_late_penalty: s.task_late_penalty,
        video_destaque_roles: s.video_destaque_roles,
        late_penalize_all_assignees: s.late_penalize_all_assignees,
        updated_at: new Date().toISOString(),
      }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["xp_settings"] });
      setLocal(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!s) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  const update = (patch: Partial<XPSettings>) => setLocal({ ...s, ...patch });
  const toggleRole = (role: string) => {
    const has = s.video_destaque_roles.includes(role);
    update({ video_destaque_roles: has ? s.video_destaque_roles.filter(r => r !== role) : [...s.video_destaque_roles, role] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Ranking Mensal</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>XP para 1º lugar</Label>
              <Input type="number" value={s.rank_1_xp} onChange={e => update({ rank_1_xp: Number(e.target.value) })} />
            </div>
            <div>
              <Label>XP para 2º lugar</Label>
              <Input type="number" value={s.rank_2_xp} onChange={e => update({ rank_2_xp: Number(e.target.value) })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Desempate: pontuação → mais tarefas concluídas → menos atrasos.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Squad Destaque</h3>
          </div>
          <div>
            <Label>XP para cada integrante do squad vencedor</Label>
            <Input type="number" value={s.squad_destaque_xp} onChange={e => update({ squad_destaque_xp: Number(e.target.value) })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Vídeo Destaque</h3>
          </div>
          <div>
            <Label>XP por envolvido</Label>
            <Input type="number" value={s.video_destaque_xp} onChange={e => update({ video_destaque_xp: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="mb-2 block">Cargos elegíveis</Label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(r => {
                const active = s.video_destaque_roles.includes(r.value);
                return (
                  <Badge
                    key={r.value}
                    variant={active ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleRole(r.value)}
                  >
                    {active && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {r.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">Atraso em Tarefa</h3>
          </div>
          <div>
            <Label>XP descontado por tarefa atrasada (use negativo)</Label>
            <Input type="number" value={s.task_late_penalty} onChange={e => update({ task_late_penalty: Number(e.target.value) })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium text-sm">Penalizar todos os responsáveis</div>
              <p className="text-xs text-muted-foreground">Quando desligado, apenas o responsável principal é penalizado.</p>
            </div>
            <Switch
              checked={s.late_penalize_all_assignees}
              onCheckedChange={(v) => update({ late_penalize_all_assignees: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground">Aplicado uma única vez por tarefa. Conclusão posterior não devolve XP.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={!local || save.isPending}>
          <Save className="h-4 w-4 mr-2" />Salvar
        </Button>
      </div>
    </div>
  );
}

// ============ Video Destaque Selector ============
function VideoDestaquePanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const qc = useQueryClient();

  const currentQ = useQuery({
    queryKey: ["xp_video_destaque", year, month],
    queryFn: async () => {
      const { data } = await supabase.from("xp_video_destaque").select("*").eq("year", year).eq("month", month).maybeSingle();
      return data;
    },
  });

  const tasksQ = useQuery({
    queryKey: ["pm_video_tasks", year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,"0")}-01`;
      const endDate = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,"0")}-${endDate}`;
      const { data, error } = await supabase
        .from("pm_tasks")
        .select("id, title, due_date, assignee_id, watchers, post_type")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .gte("due_date", start)
        .lte("due_date", end)
        .in("post_type", ["reel","video","Vídeo","Reels"])
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fallback: all tasks with tag video or stage edicao_videos
  const allTasksQ = useQuery({
    enabled: (tasksQ.data ?? []).length === 0,
    queryKey: ["pm_video_tasks_fallback", year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,"0")}-01`;
      const endDate = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,"0")}-${endDate}`;
      const { data, error } = await supabase
        .from("pm_tasks")
        .select("id, title, due_date, assignee_id, watchers, stage_current, post_type")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .gte("due_date", start)
        .lte("due_date", end)
        .order("due_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tasks = useMemo(() => {
    const primary = tasksQ.data ?? [];
    if (primary.length > 0) return primary;
    return allTasksQ.data ?? [];
  }, [tasksQ.data, allTasksQ.data]);

  const select = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.rpc("xp_apply_video_destaque" as any, {
        _pm_task_id: taskId, _year: year, _month: month,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vídeo destaque definido — XP distribuído");
      qc.invalidateQueries({ queryKey: ["xp_video_destaque"] });
      qc.invalidateQueries({ queryKey: ["rewards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" className="w-28" value={year} onChange={e => setYear(Number(e.target.value))} />
      </div>

      {currentQ.data && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <div className="text-sm">Vídeo destaque atual: <b>{tasks.find(t => t.id === currentQ.data.pm_task_id)?.title ?? currentQ.data.pm_task_id}</b></div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {tasks.length === 0 && <div className="text-sm text-muted-foreground">Nenhum vídeo encontrado neste mês.</div>}
        {tasks.map(t => (
          <Card key={t.id}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.due_date}</div>
              </div>
              <Button size="sm" onClick={() => select.mutate(t.id)} disabled={select.isPending}>
                <Trophy className="h-4 w-4 mr-1" />
                {currentQ.data?.pm_task_id === t.id ? "Atualizar" : "Marcar destaque"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ Manual Run ============
function ManualRunPanel() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [year, setYear] = useState(prev.getFullYear());
  const [month, setMonth] = useState(prev.getMonth() + 1);
  const qc = useQueryClient();

  const runRank = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("xp_apply_monthly_rankings" as any, { _year: year, _month: month });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ranking processado"); qc.invalidateQueries({ queryKey: ["rewards"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const runSquad = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("xp_apply_squad_destaque" as any, { _year: year, _month: month });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Squad destaque processado"); qc.invalidateQueries({ queryKey: ["rewards"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const runLate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("xp_apply_task_late_penalties" as any);
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => { toast.success(`${n ?? 0} penalidades aplicadas`); qc.invalidateQueries({ queryKey: ["rewards"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold">Processamento manual do mês</h3>
          <p className="text-sm text-muted-foreground">
            O processamento automático ocorre todo dia 1º (ranking/squad) e diariamente para atrasos.
            Use esta seção para forçar manualmente.
          </p>
          <div className="flex gap-2">
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" className="w-28" value={year} onChange={e => setYear(Number(e.target.value))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runRank.mutate()} disabled={runRank.isPending} variant="outline">
              <Trophy className="h-4 w-4 mr-2" />Processar ranking
            </Button>
            <Button onClick={() => runSquad.mutate()} disabled={runSquad.isPending} variant="outline">
              <Users className="h-4 w-4 mr-2" />Processar squad destaque
            </Button>
            <Button onClick={() => runLate.mutate()} disabled={runLate.isPending} variant="outline">
              <AlertTriangle className="h-4 w-4 mr-2" />Verificar atrasos agora
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cada critério só é lançado uma vez por mês — execuções repetidas são ignoradas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
