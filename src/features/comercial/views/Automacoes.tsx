import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHead } from "../components/ui-bits";
import { StatusSwitch, fmtDateTime } from "../components/BuilderBits";
import { useComercial } from "../ComercialContext";
import { useAutomations, useCreateAutomation, useForms, useUpdateAutomation } from "../hooks/use-builder";
import { countSteps, sendsMessages, type ComercialAutomation } from "../lib/builder";
import { triggerText } from "../lib/summary";
import { AutomacaoEditor } from "./AutomacaoEditor";

export function Automacoes() {
  const [params, setParams] = useSearchParams();
  const editId = params.get("edit");
  const { stages, team, goto } = useComercial();
  const autos = useAutomations();
  const forms = useForms().data ?? [];
  const create = useCreateAutomation();
  const update = useUpdateAutomation();
  const [confirm, setConfirm] = useState<ComercialAutomation | null>(null);

  const open = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set("edit", id); return n; }, { replace: true });

  if (editId) return <AutomacaoEditor key={editId} id={editId} onOpen={open} onBack={() => setParams((p) => { const n = new URLSearchParams(p); n.delete("edit"); return n; }, { replace: true })} />;

  const list = autos.data ?? [];
  const ctx = { stages, team, forms };

  const toggle = (a: ComercialAutomation) => {
    if (!a.active && sendsMessages(a.steps)) return setConfirm(a);
    update.mutate({ id: a.id, patch: { active: !a.active } }, { onSuccess: () => toast(a.active ? "Automação pausada" : "Automação ativada") });
  };

  return (
    <div className="space-y-4">
      <PageHead
        title="Automações"
        subtitle="Cada automação segue o caminho gatilho → condição → ação. Ative só depois de testar."
        right={<>
          <Button variant="outline" size="sm" onClick={() => goto("lib")}>Biblioteca de modelos</Button>
          <Button size="sm" className="gap-1.5" disabled={create.isPending}
            onClick={() => create.mutate({ name: "Nova automação", trigger: { type: "new" }, steps: [] }, { onSuccess: (a) => open(a.id) })}>
            <Plus className="h-4 w-4" /> Nova automação
          </Button>
        </>}
      />

      {autos.isLoading ? null : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 px-6 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Workflow className="h-6 w-6" /></span>
          <h3 className="text-base font-semibold">Nenhuma automação ainda</h3>
          <p className="max-w-md text-sm text-muted-foreground">Comece por um modelo pronto (boas-vindas, qualificação, follow-up de proposta…) ou monte um fluxo do zero.</p>
          <Button variant="outline" onClick={() => goto("lib")}>Ver biblioteca de modelos</Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Automação</th><th className="px-3 py-2.5 font-medium">Gatilho</th>
                <th className="px-3 py-2.5 text-right font-medium">Blocos</th><th className="px-3 py-2.5 text-right font-medium">Execuções</th>
                <th className="px-3 py-2.5 font-medium">Última</th><th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} onClick={() => open(a.id)} className="cursor-pointer border-b border-border/30 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{triggerText(a.trigger, ctx)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{countSteps(a.steps)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{a.runs}</td>
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">{fmtDateTime(a.last_run_at)}</td>
                  <td className="px-4 py-3"><StatusSwitch on={a.active} onLabel="Ativa" offLabel="Pausada" onClick={() => toggle(a)} disabled={update.isPending} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > 0 && (
        <p className="text-xs text-muted-foreground">
          As automações ativas rodam de verdade: quando o gatilho acontece, as mensagens saem pelo WhatsApp conectado e as ações mudam o lead no CRM. Gatilhos “Data programada” ainda não executam sozinhos.
        </p>
      )}


      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar “{confirm?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta automação envia mensagens de verdade pelo WhatsApp conectado quando o gatilho acontecer. Use “Testar” no editor antes se ainda não conferiu o fluxo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && update.mutate({ id: confirm.id, patch: { active: true } }, { onSuccess: () => toast("Automação ativada") })}>Ativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
