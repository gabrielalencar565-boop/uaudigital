import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { Gift, Lock, Sparkles, Trophy, Coins, TrendingUp, Plus, Pencil, Trash2, Check, X, Package, ListChecks, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LucideIconPicker, DynamicLucideIcon } from "./LucideIconPicker";

type XPCriterion = {
  id: string;
  name: string;
  description: string | null;
  xp_value: number;
  category: string;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
};

type XPSummary = {
  total_earned: number;
  total_spent: number;
  available: number;
  current_level: number;
  current_level_name: string | null;
  next_level: number | null;
  next_level_name: string | null;
  next_level_xp: number | null;
};

type Reward = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  xp_cost: number;
  min_level: number;
  is_exclusive: boolean;
  is_active: boolean;
  order_index: number;
};

type Level = {
  id: string;
  level_number: number;
  name: string;
  xp_required: number;
  exclusive_reward: string | null;
};

type Redemption = {
  id: string;
  user_id: string;
  reward_id: string;
  xp_spent: number;
  status: "pendente" | "aprovado" | "recusado" | "entregue";
  notes: string | null;
  created_at: string;
  decided_at: string | null;
  rewards?: { name: string; icon: string };
};

const statusConfig: Record<string, { label: string; color: string; emoji: string }> = {
  pendente:  { label: "Pendente",  color: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30", emoji: "🟡" },
  aprovado:  { label: "Aprovado",  color: "bg-green-500/15 text-green-600 border-green-500/30",   emoji: "🟢" },
  recusado:  { label: "Recusado",  color: "bg-red-500/15 text-red-600 border-red-500/30",         emoji: "🔴" },
  entregue:  { label: "Entregue",  color: "bg-blue-500/15 text-blue-600 border-blue-500/30",      emoji: "🔵" },
};

function fireConfetti() {
  const end = Date.now() + 800;
  const colors = ["#7C5CFF", "#FFD166", "#06D6A0", "#EF476F"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function RecompensasPanel() {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);
  const [tab, setTab] = useState<"loja" | "meus" | "admin">("loja");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Gift className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Recompensas</h2>
          <p className="text-sm text-muted-foreground">Resgate prêmios usando seu XP acumulado.</p>
        </div>
      </div>

      {user && <XPSummaryHeader userId={user.id} />}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="loja"><Gift className="h-4 w-4 mr-2" />Loja</TabsTrigger>
          <TabsTrigger value="meus"><Package className="h-4 w-4 mr-2" />Meus Resgates</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin"><Sparkles className="h-4 w-4 mr-2" />Administração</TabsTrigger>}
        </TabsList>

        <TabsContent value="loja" className="mt-6">
          {user && <RewardShop userId={user.id} />}
        </TabsContent>
        <TabsContent value="meus" className="mt-6">
          {user && <MyRedemptions userId={user.id} />}
        </TabsContent>
        {isAdmin && (
          <TabsContent value="admin" className="mt-6">
            <AdminSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ============ XP Summary Header ============
function XPSummaryHeader({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["rewards", "xp_summary", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_xp_summary", { _user_id: userId });
      if (error) throw error;
      return (data as any[])?.[0] as XPSummary;
    },
  });

  if (!data) return null;
  const progress = data.next_level_xp
    ? Math.min(100, (data.total_earned / data.next_level_xp) * 100)
    : 100;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="h-4 w-4" />XP Disponível
          </div>
          <div className="mt-2 text-3xl font-bold text-primary">{data.available.toLocaleString("pt-BR")}</div>
          <div className="mt-1 text-xs text-muted-foreground">de {data.total_earned.toLocaleString("pt-BR")} XP total</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />Nível Atual
          </div>
          <div className="mt-2 text-3xl font-bold">Nível {data.current_level}</div>
          <div className="mt-1 text-xs text-muted-foreground">{data.current_level_name ?? "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />Próximo Nível
          </div>
          {data.next_level ? (
            <>
              <div className="mt-2 text-base font-semibold">Nível {data.next_level} · {data.next_level_name}</div>
              <Progress value={progress} className="mt-2 h-2" />
              <div className="mt-1 text-xs text-muted-foreground">
                Faltam {Math.max(0, (data.next_level_xp ?? 0) - data.total_earned).toLocaleString("pt-BR")} XP
              </div>
            </>
          ) : (
            <div className="mt-2 text-base font-semibold">🏆 Nível máximo!</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Reward Shop ============
function RewardShop({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<Reward | null>(null);

  const summaryQ = useQuery({
    queryKey: ["rewards", "xp_summary", userId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_xp_summary", { _user_id: userId });
      return (data as any[])?.[0] as XPSummary;
    },
  });

  const rewardsQ = useQuery({
    queryKey: ["rewards", "catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rewards").select("*").eq("is_active", true).order("order_index");
      if (error) throw error;
      return data as Reward[];
    },
  });

  const redeem = useMutation({
    mutationFn: async (reward: Reward) => {
      const { error } = await supabase.from("reward_redemptions").insert({
        user_id: userId, reward_id: reward.id, xp_spent: reward.xp_cost,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      fireConfetti();
      toast.success("Resgate solicitado! Aguarde aprovação 🎉");
      qc.invalidateQueries({ queryKey: ["rewards"] });
      setConfirming(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao resgatar"),
  });

  const summary = summaryQ.data;
  const rewards = rewardsQ.data ?? [];
  const available = summary?.available ?? 0;
  const currentLevel = summary?.current_level ?? 0;

  // Recommendation: closest reward the user can almost afford
  const recommended = useMemo(() => {
    if (!summary) return null;
    return rewards
      .filter(r => r.xp_cost > available && r.min_level <= currentLevel)
      .sort((a, b) => (a.xp_cost - available) - (b.xp_cost - available))[0];
  }, [rewards, available, currentLevel, summary]);

  const exclusives = rewards.filter(r => r.is_exclusive);
  const regular = rewards.filter(r => !r.is_exclusive);

  return (
    <div className="space-y-8">
      {recommended && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm">
              Você possui <span className="font-semibold">{available} XP</span>. Faltam apenas{" "}
              <span className="font-semibold text-primary">{recommended.xp_cost - available} XP</span> para resgatar{" "}
              <span className="font-semibold">{recommended.name}</span>.
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <h3 className="mb-3 text-lg font-semibold flex items-center gap-2"><Gift className="h-5 w-5" />Loja de Recompensas</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {regular.map(r => (
            <RewardCard key={r.id} reward={r} available={available} currentLevel={currentLevel}
              onRedeem={() => setConfirming(r)} />
          ))}
          {regular.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma recompensa cadastrada.</div>}
        </div>
      </section>

      {exclusives.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />Recompensas Exclusivas
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {exclusives.map(r => (
              <RewardCard key={r.id} reward={r} available={available} currentLevel={currentLevel}
                exclusive onRedeem={() => setConfirming(r)} />
            ))}
          </div>
        </section>
      )}

      <AlertDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resgatar {confirming?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a gastar <b>{confirming?.xp_cost} XP</b>. Seu saldo ficará em{" "}
              <b>{available - (confirming?.xp_cost ?? 0)} XP</b>. O resgate ficará pendente até a aprovação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirming && redeem.mutate(confirming)} disabled={redeem.isPending}>
              Confirmar resgate 🎁
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RewardCard({ reward, available, currentLevel, exclusive, onRedeem }: {
  reward: Reward; available: number; currentLevel: number; exclusive?: boolean; onRedeem: () => void;
}) {
  const levelLocked = currentLevel < reward.min_level;
  const xpLocked = available < reward.xp_cost;
  const locked = levelLocked || xpLocked;

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all hover:shadow-md",
      locked && "opacity-70",
      exclusive && !locked && "ring-2 ring-amber-400/40"
    )}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary text-2xl">
            🎁
          </div>
          {exclusive && <Badge variant="outline" className="border-amber-400/50 text-amber-600">Exclusivo</Badge>}
        </div>
        <div>
          <div className="font-semibold leading-tight">{reward.name}</div>
          {reward.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{reward.description}</p>}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="text-lg font-bold text-primary">{reward.xp_cost} XP</div>
          <div className="text-xs text-muted-foreground">Nível {reward.min_level}+</div>
        </div>
        {levelLocked ? (
          <Button disabled variant="outline" className="w-full gap-2">
            <Lock className="h-4 w-4" />Desbloqueado no Nível {reward.min_level}
          </Button>
        ) : xpLocked ? (
          <Button disabled variant="outline" className="w-full">
            Faltam {reward.xp_cost - available} XP
          </Button>
        ) : (
          <Button onClick={onRedeem} className="w-full">Resgatar 🎁</Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============ My Redemptions ============
function MyRedemptions({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["rewards", "my_redemptions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_redemptions")
        .select("*, rewards(name, icon)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Redemption[];
    },
  });

  const items = q.data ?? [];
  if (items.length === 0) return <div className="text-sm text-muted-foreground">Você ainda não fez nenhum resgate.</div>;

  return (
    <div className="space-y-3">
      {items.map(r => {
        const sc = statusConfig[r.status];
        return (
          <Card key={r.id}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xl">🎁</div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.rewards?.name ?? "Recompensa"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")} · {r.xp_spent} XP
                  </div>
                </div>
              </div>
              <Badge variant="outline" className={cn(sc.color, "shrink-0")}>{sc.emoji} {sc.label}</Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============ Admin Section ============
function AdminSection() {
  return (
    <Tabs defaultValue="aprovacoes">
      <TabsList>
        <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>
        <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
        <TabsTrigger value="niveis">Níveis</TabsTrigger>
        <TabsTrigger value="xp">Lançar XP</TabsTrigger>
      </TabsList>
      <TabsContent value="aprovacoes" className="mt-4"><AdminApprovals /></TabsContent>
      <TabsContent value="catalogo" className="mt-4"><AdminCatalog /></TabsContent>
      <TabsContent value="niveis" className="mt-4"><AdminLevels /></TabsContent>
      <TabsContent value="xp" className="mt-4"><AdminGrantXP /></TabsContent>
    </Tabs>
  );
}

function AdminApprovals() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["rewards", "all_redemptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_redemptions")
        .select("*, rewards(name, icon)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Redemption[];
    },
  });

  const membersQ = useQuery({
    queryKey: ["team_members_all"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url");
      return data ?? [];
    },
  });
  const members = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string | null }> = {};
    (membersQ.data ?? []).forEach((tm: any) => { m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url }; });
    return m;
  }, [membersQ.data]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Redemption["status"] }) => {
      const patch: any = { status, decided_at: new Date().toISOString() };
      if (status === "entregue") patch.delivered_at = new Date().toISOString();
      const { error } = await supabase.from("reward_redemptions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["rewards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const items = q.data ?? [];
  return (
    <div className="space-y-2">
      {items.length === 0 && <div className="text-sm text-muted-foreground">Nenhum resgate ainda.</div>}
      {items.map(r => {
        const sc = statusConfig[r.status];
        const m = members[r.user_id];
        return (
          <Card key={r.id}>
            <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={m?.avatar ?? undefined} />
                  <AvatarFallback>{(m?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{m?.name ?? "—"} · {r.rewards?.name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")} · {r.xp_spent} XP</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={sc.color}>{sc.emoji} {sc.label}</Badge>
                {r.status === "pendente" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "aprovado" })}>
                      <Check className="h-4 w-4 mr-1" />Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "recusado" })}>
                      <X className="h-4 w-4 mr-1" />Recusar
                    </Button>
                  </>
                )}
                {r.status === "aprovado" && (
                  <Button size="sm" onClick={() => updateStatus.mutate({ id: r.id, status: "entregue" })}>
                    Marcar entregue
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AdminCatalog() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Reward> | null>(null);
  const q = useQuery({
    queryKey: ["rewards", "catalog_admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rewards").select("*").order("order_index");
      if (error) throw error;
      return data as Reward[];
    },
  });

  const save = useMutation({
    mutationFn: async (r: Partial<Reward>) => {
      const payload = {
        name: r.name, description: r.description, icon: r.icon ?? "gift",
        xp_cost: Number(r.xp_cost ?? 0), min_level: Number(r.min_level ?? 1),
        is_exclusive: !!r.is_exclusive, is_active: r.is_active ?? true,
        order_index: Number(r.order_index ?? 0),
      };
      if (r.id) {
        const { error } = await supabase.from("rewards").update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rewards").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["rewards"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["rewards"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Button onClick={() => setEditing({ name: "", xp_cost: 100, min_level: 1, is_active: true })}>
        <Plus className="h-4 w-4 mr-1" />Nova recompensa
      </Button>
      <div className="space-y-2">
        {(q.data ?? []).map(r => (
          <Card key={r.id}>
            <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-medium">{r.name} {r.is_exclusive && <Badge variant="outline" className="ml-1">Exclusivo</Badge>}</div>
                <div className="text-xs text-muted-foreground">{r.xp_cost} XP · Nível {r.min_level}+ {!r.is_active && "· Inativo"}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(r.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} recompensa</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing.name ?? ""} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Custo XP</Label><Input type="number" value={editing.xp_cost ?? 0} onChange={e => setEditing({ ...editing, xp_cost: Number(e.target.value) })} /></div>
                <div><Label>Nível mínimo</Label><Input type="number" value={editing.min_level ?? 1} onChange={e => setEditing({ ...editing, min_level: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center justify-between"><Label>Exclusivo</Label><Switch checked={!!editing.is_exclusive} onCheckedChange={v => setEditing({ ...editing, is_exclusive: v })} /></div>
              <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={editing.is_active ?? true} onCheckedChange={v => setEditing({ ...editing, is_active: v })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminLevels() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Level> | null>(null);
  const q = useQuery({
    queryKey: ["rewards", "levels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reward_levels").select("*").order("level_number");
      if (error) throw error;
      return data as Level[];
    },
  });

  const save = useMutation({
    mutationFn: async (l: Partial<Level>) => {
      const payload = {
        level_number: Number(l.level_number ?? 1),
        name: l.name ?? "Nível",
        xp_required: Number(l.xp_required ?? 0),
        exclusive_reward: l.exclusive_reward || null,
      };
      if (l.id) {
        const { error } = await supabase.from("reward_levels").update(payload).eq("id", l.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reward_levels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["rewards", "levels"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reward_levels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards", "levels"] }),
  });

  return (
    <div className="space-y-3">
      <Button onClick={() => setEditing({ level_number: 1, xp_required: 0, name: "" })}>
        <Plus className="h-4 w-4 mr-1" />Novo nível
      </Button>
      <div className="space-y-2">
        {(q.data ?? []).map(l => (
          <Card key={l.id}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Nível {l.level_number} · {l.name}</div>
                <div className="text-xs text-muted-foreground">{l.xp_required} XP {l.exclusive_reward && `· 🏆 ${l.exclusive_reward}`}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(l)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) del.mutate(l.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} nível</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Número</Label><Input type="number" value={editing.level_number ?? 1} onChange={e => setEditing({ ...editing, level_number: Number(e.target.value) })} /></div>
                <div><Label>XP necessário</Label><Input type="number" value={editing.xp_required ?? 0} onChange={e => setEditing({ ...editing, xp_required: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Nome</Label><Input value={editing.name ?? ""} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Recompensa exclusiva (opcional)</Label><Input value={editing.exclusive_reward ?? ""} onChange={e => setEditing({ ...editing, exclusive_reward: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminGrantXP() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");

  const membersQ = useQuery({
    queryKey: ["team_members_active"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name").eq("is_active", true).order("display_name");
      return data ?? [];
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      if (!userId || !reason.trim()) throw new Error("Preencha usuário e motivo");
      const { error } = await supabase.from("user_xp_events").insert({
        user_id: userId, amount, reason, source_type: "manual", created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("XP lançado");
      qc.invalidateQueries({ queryKey: ["rewards"] });
      setReason(""); setAmount(100);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div>
          <Label>Colaborador</Label>
          <select className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">Selecione…</option>
            {(membersQ.data ?? []).map((m: any) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </select>
        </div>
        <div><Label>Quantidade de XP (positivo ou negativo)</Label><Input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></div>
        <div><Label>Motivo</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: Bônus de performance" /></div>
        <Button onClick={() => grant.mutate()} disabled={grant.isPending}>Lançar XP</Button>
      </CardContent>
    </Card>
  );
}
