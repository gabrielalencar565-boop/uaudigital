import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MAGIC_STAGES, type MagicStageKey } from "@/lib/uau";
import { useClients, useCreateClient, useDeactivateClientFromMonth, useToggleChecklistStageTasks } from "@/features/data/queries";
import { useAllClientCycleStages } from "@/features/data/stages-queries";
import { useClientCycles } from "@/features/data/stages-queries";
import { useSetMonthlyStageCompletion } from "@/features/data/stages-mutations";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
type MagicChecklistTableProps = {
  year: number;
  month: number;
  onMonthChange: (nextMonth: number) => void;
};
const createClientSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120)
});
type CreateClientValues = z.infer<typeof createClientSchema>;
export function MagicChecklistTable({
  year,
  month,
  onMonthChange
}: MagicChecklistTableProps) {
  const {
    user
  } = useSession();
  const {
    isAdmin
  } = useRole(user?.id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createClient = useCreateClient();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeClientId, setRemoveClientId] = useState<string>("");

  // UI otimista por célula (clientId + stage) para refletir imediatamente o clique,
  // mesmo quando o refetch demorar ou o RPC não tiver tarefas para alternar.
  const [cellOverrides, setCellOverrides] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const form = useForm<CreateClientValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: ""
    }
  });
  const clientsQ = useClients();
  const allStagesQ = useAllClientCycleStages(year);
  const cyclesQ = useClientCycles(year);
  // Clique no checklist: toggle manual da etapa (Dashboard lê daqui).
  const toggleStageTasks = useToggleChecklistStageTasks();
  // Fallback: quando não há tarefas para alternar, ainda assim precisamos marcar/desmarcar a etapa no checklist mensal.
  const setMonthlyStageCompletion = useSetMonthlyStageCompletion();
  const deactivateFromMonth = useDeactivateClientFromMonth();
  const clients = clientsQ.data ?? [];
  const allStages = allStagesQ.data ?? [];
  const cycles = cyclesQ.data ?? [];
  const activeClientIdsForMonth = useMemo(() => {
    const set = new Set<string>();
    for (const row of cycles) {
      if (row.year === year && row.month === month && row.is_active) set.add(row.client_id);
    }
    return set;
  }, [cycles, month, year]);
  const clientsSorted = useMemo(() => {
    const filtered = clients.filter(c => activeClientIdsForMonth.has(c.id));
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", {
      sensitivity: "base",
      numeric: true
    }));
  }, [activeClientIdsForMonth, clients]);
  const stageByClient = useMemo(() => {
    const map = new Map<string, Map<MagicStageKey, {
      completed: boolean;
    }>>();
    for (const row of allStages) {
      if (row.year !== year || row.month !== month) continue;
      const clientId = row.client_id;
      const clientMap = map.get(clientId) ?? new Map<MagicStageKey, {
        completed: boolean;
      }>();
      // Guard: só consideramos as etapas do Magic Number
      if (MAGIC_STAGES.some(s => s.key === row.stage)) {
        clientMap.set(row.stage as MagicStageKey, {
          completed: row.completed
        });
      }
      map.set(clientId, clientMap);
    }
    return map;
  }, [allStages, month, year]);

  // Limpa overrides otimistas somente quando o cache do backend já refletiu o mesmo valor.
  // Isso evita o efeito “cliquei e não marcou” em caso de refetch lento/atualização assíncrona.
  useEffect(() => {
    setCellOverrides(prev => {
      const keys = Object.keys(prev);
      if (!keys.length) return prev;
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const k of keys) {
        const [clientId, stage] = k.split(":");
        const completedFromQuery = stageByClient.get(clientId)?.get(stage as MagicStageKey)?.completed;
        if (typeof completedFromQuery === "boolean" && completedFromQuery === prev[k]) {
          changed = true; // remove
          continue;
        }
        next[k] = prev[k];
      }
      return changed ? next : prev;
    });
  }, [stageByClient]);
  const completionPct = useMemo(() => {
    if (!clientsSorted.length) return 0;
    let fullyDone = 0;
    for (const c of clientsSorted) {
      const cm = stageByClient.get(c.id);
      const doneCount = MAGIC_STAGES.reduce((acc, st) => acc + (cm?.get(st.key)?.completed ? 1 : 0), 0);
      if (doneCount >= MAGIC_STAGES.length) fullyDone += 1;
    }
    return Math.round(fullyDone / clientsSorted.length * 100);
  }, [clientsSorted, stageByClient]);
  const goPrev = () => onMonthChange(Math.max(1, month - 1));
  const goNext = () => onMonthChange(Math.min(12, month + 1));
  const onCreate = async (v: CreateClientValues) => {
    try {
      const magic_due_date = `${year}-${String(month).padStart(2, "0")}-27`;
      await createClient.mutateAsync({
        name: v.name,
        magic_due_date
      });
      toast.success("Cliente criado. Projeto fluindo bem 🚀");
      setCreateOpen(false);
      form.reset({
        name: ""
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar cliente");
    }
  };
  const onRemoveClient = async () => {
    if (!isAdmin) return;
    if (!removeClientId) {
      toast.error("Selecione um cliente");
      return;
    }
    const name = clients.find(c => c.id === removeClientId)?.name ?? "este cliente";
    const ok = window.confirm(`Remover ${name} a partir de ${String(month).padStart(2, "0")}/${year} (mês selecionado e futuros)? Meses anteriores permanecem no histórico.`);
    if (!ok) return;
    try {
      await deactivateFromMonth.mutateAsync({
        clientId: removeClientId,
        year,
        fromMonth: month
      });
      toast.success("Cliente removido do mês e futuros");
      setRemoveOpen(false);
      setRemoveClientId("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover cliente");
    }
  };
  const onToggle = async (clientId: string, stage: MagicStageKey, currentCompleted: boolean) => {
    if (!user) {
      toast.error("Você precisa entrar para marcar etapas.");
      navigate("/auth");
      return;
    }
    try {
      const res = await toggleStageTasks.mutateAsync({
        clientId,
        stage,
        year,
        month
      });
      if (!res) return;

      // IMPORTANTE: o Dashboard/Checklist do Magic Number lê EXCLUSIVAMENTE de client_cycle_stages.
      // O RPC alterna tarefas, mas não é garantido que ele atualize a tabela do checklist mensal.
      // Para o clique SEMPRE refletir visualmente (e no dashboard), sincronizamos o status aqui.
      // Fonte da verdade do clique: o RPC retorna o estado final da etapa (stage_completed).
      // Isso evita “alternar errado” quando o UI/cache local está desatualizado.
      const nextCompleted = typeof (res as any).stage_completed === "boolean" ? Boolean((res as any).stage_completed) : (res as any).new_status === "concluido" ? true : (res as any).new_status === "pendente" ? false : !currentCompleted;
      const cellKey = `${clientId}:${stage}`;
      setCellOverrides(prev => ({
        ...prev,
        [cellKey]: nextCompleted
      }));
      await setMonthlyStageCompletion.mutateAsync({
        clientId,
        stage,
        year,
        month,
        completed: nextCompleted,
        userId: user.id
      });

      // Força o Dashboard/Checklist a refazer as queries (mesmas queryKeys do MagicPanel).
      await Promise.all([qc.invalidateQueries({
        queryKey: ["client_cycle_stages", {
          year
        }]
      }), qc.invalidateQueries({
        queryKey: ["client_cycles", year]
      })]);
      await qc.refetchQueries({
        queryKey: ["client_cycle_stages", {
          year
        }]
      });
      toast.success(res.new_status === "concluido" ? "Etapa marcada" : "Etapa desmarcada");

      // Auto-avança quando o mês ficar 100% concluído (todos os clientes com 7/7 etapas do Magic), com confirmação.
      if (res.stage_completed && clientsSorted.length && month < 12) {
        const doneNow = clientsSorted.every(c => {
          const cm = stageByClient.get(c.id);
          const doneCount = MAGIC_STAGES.reduce((acc, st) => acc + (cm?.get(st.key)?.completed ? 1 : 0), 0);
          return doneCount >= MAGIC_STAGES.length;
        });
        if (doneNow) {
          const ok = window.confirm(`Mês ${String(month).padStart(2, "0")}/${year} ficou 100% concluído. Ir para o próximo mês?`);
          if (ok) onMonthChange(month + 1);
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar tarefas/etapa");
    }
  };
  return <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <label className="text-xs text-muted-foreground">Mês</label>
            <Button type="button" variant="outline" size="icon" onClick={goPrev} disabled={month <= 1} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <select className="h-9 rounded-md border border-border bg-background px-3 text-sm" value={month} onChange={e => onMonthChange(Number(e.target.value))}>
              {Array.from({
              length: 12
            }, (_, i) => i + 1).map(m => <option key={m} value={m}>
                  {String(m).padStart(2, "0")}
                </option>)}
            </select>
            <Button type="button" variant="outline" size="icon" onClick={goNext} disabled={month >= 12} aria-label="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!user ? <div className="flex flex-col gap-2 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Para marcar etapas no checklist e atualizar o Dashboard, você precisa entrar.
            </p>
            <Button type="button" variant="brand" onClick={() => navigate("/auth")}>
              Ir para login
            </Button>
          </div> : null}
        <div className="w-full overflow-auto">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[200px]" />
              {MAGIC_STAGES.map(st => <col key={st.key} className="w-[104px]" />)}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 w-[200px] bg-background px-2 py-1.5 text-[11px]">
                  Cliente
                </TableHead>
                {MAGIC_STAGES.map(st => <TableHead key={st.key} className="min-w-[104px] whitespace-nowrap px-1.5 py-1.5 text-center text-[10px]">
                    {st.label.toUpperCase()}
                  </TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientsSorted.map(c => {
              const cm = stageByClient.get(c.id);
              return <TableRow key={c.id}>
                    <TableCell className="sticky left-0 z-10 w-[200px] min-w-[200px] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap bg-background px-2 py-1.5 text-[13px] font-medium">
                      {c.name}
                    </TableCell>
                    {MAGIC_STAGES.map(st => {
                  const overrideKey = `${c.id}:${st.key}`;
                  const completed = cellOverrides[overrideKey] ?? cm?.get(st.key)?.completed ?? false;
                  const editable = !!user;
                  return <TableCell key={st.key} className={cn("relative px-1.5 py-1 text-center", editable && !toggleStageTasks.isPending && "cursor-pointer")} onClick={() => {
                    if (!editable || toggleStageTasks.isPending) return;
                    onToggle(c.id, st.key, completed);
                  }}>
                          <Button type="button" variant="outline" size="icon" disabled={!editable || toggleStageTasks.isPending} onClick={e => {
                      // Evita disparar também o onClick do <TableCell> (senão alterna 2x e parece que "não marcou")
                      e.stopPropagation();
                      onToggle(c.id, st.key, completed);
                    }} className={cn("relative z-20 h-6 w-6 pointer-events-auto", completed && "bg-success text-success-foreground hover:bg-success/90 border-success/40")} aria-pressed={completed} aria-label={`${c.name}: ${st.label}`}>
                            {completed ? <Check className="h-3 w-3" /> : null}
                          </Button>
                        </TableCell>;
                })}
                  </TableRow>;
            })}
            </TableBody>
          </Table>
        </div>

        {isAdmin && <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-start">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="brand">
                  Novo cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Cadastrar cliente</DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={form.handleSubmit(onCreate)}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Cliente</Label>
                    <Input id="name" placeholder="Ex.: Cliente X" {...form.register("name")} />
                    {form.formState.errors.name && <p className="text-sm text-danger">{form.formState.errors.name.message}</p>}
                  </div>

                  <DialogFooter>
                    <Button type="submit" variant="hero" disabled={createClient.isPending}>
                      {createClient.isPending ? "Salvando..." : "Criar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive">
                  Remover cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Remover cliente</DialogTitle>
                </DialogHeader>

                <div className="space-y-2">
                  <Label htmlFor="remove-client">Cliente</Label>
                  <select id="remove-client" className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" value={removeClientId} onChange={e => setRemoveClientId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {clientsSorted.map(c => <option key={c.id} value={c.id}>
                        {c.name}
                      </option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Isso remove o cliente do mês selecionado e dos futuros (sem apagar históricos anteriores).
                  </p>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRemoveOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" variant="destructive" onClick={onRemoveClient} disabled={deactivateFromMonth.isPending || !removeClientId}>
                    {deactivateFromMonth.isPending ? "Removendo..." : "Remover"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>}
      </CardContent>
    </Card>;
}