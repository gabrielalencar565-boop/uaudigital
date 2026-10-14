import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useComercial } from "../ComercialContext";
import { useCreateStage, useDeleteStage, useSaveStage, useSwapStages } from "../hooks/use-comercial";
import type { Stage } from "../lib/rules";
import { initials } from "../lib/rules";
import { CanaisConectados } from "../components/CanaisConectados";
import { OwnerAvatar, PageHead, Panel } from "../components/ui-bits";

function StageRow({ stage, index, openStages, count, onDelete }: { stage: Stage; index: number; openStages: Stage[]; count: number; onDelete: () => void }) {
  const save = useSaveStage();
  const swap = useSwapStages();
  const [name, setName] = useState(stage.name);
  const [prob, setProb] = useState(String(stage.probability));
  useEffect(() => { setName(stage.name); setProb(String(stage.probability)); }, [stage.name, stage.probability]);
  const open = stage.type === "open";
  const up = openStages[index - 1];
  const down = openStages[index + 1];

  return (
    <div className="flex items-center gap-2">
      {open ? (
        <div className="flex shrink-0 gap-1">
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={!up} aria-label="Subir" onClick={() => up && swap.mutate({ a: stage, b: up })}><ArrowUp className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={!down} aria-label="Descer" onClick={() => down && swap.mutate({ a: stage, b: down })}><ArrowDown className="h-3.5 w-3.5" /></Button>
        </div>
      ) : (
        <span className={cn("w-[72px] shrink-0 rounded-md px-2 py-1 text-center text-[11px] font-medium", stage.type === "won" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
          {stage.type === "won" ? "ganho" : "perda"}
        </span>
      )}
      <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { const n = name.trim(); if (n && n !== stage.name) save.mutate({ id: stage.id, patch: { name: n } }); else setName(stage.name); }} aria-label="Nome da etapa" className="h-9" />
      {open && (
        <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Input type="number" min={0} max={100} value={prob} onChange={(e) => setProb(e.target.value)} aria-label="Probabilidade %" title="Probabilidade de fechamento (%)"
            onBlur={() => { const p = Math.max(0, Math.min(100, Number(prob) || 0)); setProb(String(p)); if (p !== stage.probability) save.mutate({ id: stage.id, patch: { probability: p } }); }} className="h-9 w-16 text-right tabular-nums" />%
        </div>
      )}
      <span className="w-[64px] shrink-0 text-right text-xs tabular-nums text-muted-foreground">{count} lead{count !== 1 ? "s" : ""}</span>
      {open ? <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Excluir etapa" onClick={onDelete}><X className="h-4 w-4" /></Button> : <span className="w-8 shrink-0" />}
    </div>
  );
}

export function Configuracoes() {
  const { stages, leads, team } = useComercial();
  const create = useCreateStage();
  const del = useDeleteStage();
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<Stage | null>(null);
  const [moveTo, setMoveTo] = useState("");

  const sorted = [...stages].sort((a, b) => a.position - b.position);
  const openStages = sorted.filter((s) => s.type === "open");
  const countOf = (id: string) => leads.filter((l) => l.stage_id === id).length;

  const askDelete = (s: Stage) => {
    if (openStages.length <= 1) return toast.error("O funil precisa de pelo menos uma etapa aberta");
    if (countOf(s.id) === 0) return del.mutate({ stageId: s.id, moveTo: null }, { onSuccess: () => toast("Etapa excluída") });
    setMoveTo(openStages.find((o) => o.id !== s.id)?.id ?? "");
    setDeleting(s);
  };

  return (
    <div className="space-y-4">
      <PageHead title="Configurações" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="Etapas do funil">
          <p className="mb-3 text-xs text-muted-foreground">Renomeie, reordene, defina a probabilidade de fechamento de cada etapa ou crie novas. “Ganho” e “Perdido” são fixas.</p>
          <div className="space-y-2">
            {sorted.map((s) => (
              <StageRow key={s.id} stage={s} index={openStages.findIndex((o) => o.id === s.id)} openStages={openStages} count={countOf(s.id)} onDelete={() => askDelete(s)} />
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); const n = newName.trim(); if (n) create.mutate({ name: n, stages }, { onSuccess: () => { setNewName(""); toast(`Etapa criada antes de ${sorted.find((s) => s.type !== "open")?.name ?? "Ganho"}`); } }); }}
          >
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova etapa (ex.: Proposta enviada)" className="h-9" />
            <Button type="submit" variant="outline" className="h-9" disabled={!newName.trim() || create.isPending}>Adicionar etapa</Button>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title="Equipe">
            <p className="mb-2 text-xs text-muted-foreground">A equipe do CRM é a mesma do Fluxo: quem está ativo aparece para ser responsável por leads e atividades. Para incluir ou mudar alguém, use Configurações → Equipe.</p>
            <ul className="divide-y divide-border/30">
              {team.map((m) => (
                <li key={m.user_id} className="flex items-center gap-2.5 py-2">
                  <OwnerAvatar member={m} size="h-7 w-7" />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.display_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{m.role_title || initials(m.display_name)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <CanaisConectados />
        </div>
      </div>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir “{deleting?.name}”</DialogTitle>
            <DialogDescription>Essa etapa tem {deleting ? countOf(deleting.id) : 0} lead{deleting && countOf(deleting.id) !== 1 ? "s" : ""}. Para onde eles vão?</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Mover para</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{openStages.filter((o) => o.id !== deleting?.id).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button disabled={!moveTo || del.isPending} onClick={() => deleting && del.mutate({ stageId: deleting.id, moveTo }, { onSuccess: () => { toast("Etapa excluída"); setDeleting(null); } })}>Mover e excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
