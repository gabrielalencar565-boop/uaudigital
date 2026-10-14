import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Copy, FlaskConical, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AutomationTest } from "../components/AutomationTest";
import { Lab, Sel, StatusSwitch, inputCls } from "../components/BuilderBits";
import { useComercial } from "../ComercialContext";
import { useAutosave } from "../hooks/use-autosave";
import { useAutomations, useCreateAutomation, useDeleteAutomation, useForms, useSaveTemplate, useUpdateAutomation } from "../hooks/use-builder";
import {
  BLOCKS, COND_FIELDS, SAVE_TO, TRIGGERS, clone, findList, findStep, makeStep, reid, sendsMessages,
  type ComercialAutomation, type Step, type StepType, type Trigger, type TriggerType,
} from "../lib/builder";
import { ACTIVITY_TYPES, isOpenStage } from "../lib/rules";
import { blockSummary, triggerText } from "../lib/summary";

interface Draft { name: string; trigger: Trigger; steps: Step[] }

const GROUP_TONE: Record<string, string> = {
  msg: "border-l-violet-500", logic: "border-l-amber-500", act: "border-l-emerald-500",
};

/** Lista de linhas (uma opção por linha). Guarda o texto digitado, para a quebra de linha não sumir enquanto a pessoa escreve. */
function Lines({ value, onChange, rows = 4 }: { value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <textarea
      rows={rows} value={text} className={cn(inputCls, "resize-y")}
      onChange={(e) => { setText(e.target.value); onChange(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean)); }}
    />
  );
}

export function AutomacaoEditor({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen: (id: string) => void }) {
  const { stages, team } = useComercial();
  const autosQ = useAutomations();
  const forms = useForms().data ?? [];
  const update = useUpdateAutomation();
  const create = useCreateAutomation();
  const remove = useDeleteAutomation();
  const saveTpl = useSaveTemplate();

  const row = autosQ.data?.find((a) => a.id === id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sel, setSel] = useState<string>("trigger");
  const [ins, setIns] = useState<{ key: string; idx: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirm, setConfirm] = useState<"activate" | "delete" | null>(null);

  useEffect(() => {
    if (row && !draft) setDraft({ name: row.name, trigger: clone(row.trigger), steps: clone(row.steps) });
  }, [row, draft]);

  const saveState = useAutosave(draft, (d) => update.mutate({ id, patch: { name: d.name.trim() || "Automação", trigger: d.trigger, steps: d.steps } }));

  const edit = useCallback((fn: (d: Draft) => void) => setDraft((prev) => { if (!prev) return prev; const c = clone(prev); fn(c); return c; }), []);

  const ctx = useMemo(() => ({ stages, team, forms }), [stages, team, forms]);
  const openStages = stages.filter(isOpenStage);
  const owners: Array<[string, string]> = [["lead", "Responsável do lead"], ...team.map((t): [string, string] => [t.user_id, t.display_name])];

  if (autosQ.isLoading || (row && !draft)) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!row || !draft) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="gap-1" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Automações</Button>
        <p className="text-sm text-muted-foreground">Essa automação não existe mais.</p>
      </div>
    );
  }

  const current: ComercialAutomation = { ...row, name: draft.name, trigger: draft.trigger, steps: draft.steps };

  const activate = () => update.mutate({ id, patch: { active: true } }, { onSuccess: () => toast("Automação ativada") });
  const toggle = () => {
    if (row.active) return update.mutate({ id, patch: { active: false } }, { onSuccess: () => toast("Automação pausada") });
    if (sendsMessages(draft.steps)) return setConfirm("activate");
    activate();
  };

  const addStep = (type: StepType) => {
    if (!ins) return;
    const step = makeStep(type, forms[0]?.id);
    edit((d) => { findList(ins.key, d.steps)?.splice(ins.idx, 0, step); });
    setSel(step.id); setIns(null);
  };

  const duplicate = () => create.mutate(
    { name: `${draft.name} (cópia)`, trigger: draft.trigger, steps: reid(clone(draft.steps)) },
    { onSuccess: (a) => { toast("Cópia criada (pausada)"); setDraft(null); setSel("trigger"); onOpen(a.id); } },
  );

  // ───────────── canvas ─────────────

  const plus = (k: string, i: number, inBranch: boolean) => {
    const openMenu = ins?.key === k && ins.idx === i;
    return (
      <>
        <div className="h-4 w-px bg-border" />
        <div className="relative">
          <button
            type="button" aria-label="Adicionar bloco" aria-expanded={openMenu} onClick={() => setIns(openMenu ? null : { key: k, idx: i })}
            className="grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary"
          ><Plus className="h-3.5 w-3.5" /></button>
          {openMenu && (
            <div className="absolute left-1/2 top-8 z-20 w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl">
              {(Object.entries(BLOCKS) as Array<[StepType, (typeof BLOCKS)[StepType]]>).filter(([t]) => !(inBranch && t === "cond")).map(([t, b]) => (
                <button key={t} type="button" onClick={() => addStep(t)} className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-muted">
                  <span className="text-sm font-medium">{b.name}</span><span className="text-xs text-muted-foreground">{b.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="h-4 w-px bg-border" />
      </>
    );
  };

  const node = (s: Step) => {
    const sum = blockSummary(s, ctx);
    return (
      <button
        type="button" onClick={() => { setSel(s.id); setIns(null); }}
        className={cn("w-[300px] max-w-full rounded-xl border border-l-4 bg-card px-3.5 py-2.5 text-left transition hover:shadow-md", GROUP_TONE[BLOCKS[s.type].group], sel === s.id ? "border-primary ring-2 ring-primary/30" : "border-border/60")}
      >
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{BLOCKS[s.type].name}</span>
        <span className="mt-0.5 block break-words text-sm">{sum.main}</span>
        {sum.sub && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{sum.sub}</span>}
      </button>
    );
  };

  const renderList = (list: Step[], key: string, inBranch: boolean): React.ReactNode => (
    <>
      {list.map((s, i) => (
        <div key={s.id} className="flex flex-col items-center">
          {plus(key, i, inBranch)}
          {node(s)}
          {s.type === "cond" && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-start gap-4">
                {(["yes", "no"] as const).map((br) => (
                  <div key={br} className="flex flex-col items-center rounded-xl border border-dashed border-border/70 px-3 pb-3 pt-1.5">
                    <span className={cn("rounded-full px-2 py-px text-[10px] font-semibold uppercase", br === "yes" ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500")}>{br === "yes" ? "Sim" : "Não"}</span>
                    {renderList((br === "yes" ? s.yes : s.no) ?? [], `${s.id}:${br}`, true)}
                    {plus(`${s.id}:${br}`, ((br === "yes" ? s.yes : s.no) ?? []).length, true)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );

  // ───────────── inspector ─────────────

  const found = sel === "trigger" ? null : findStep(sel, draft.steps);
  const setStep = (patch: Partial<Step>) => edit((d) => { const f = findStep(sel, d.steps); if (f) Object.assign(f.step, patch); });
  const setTrigger = (patch: Partial<Trigger>) => edit((d) => { Object.assign(d.trigger, patch); });

  const inspector = (() => {
    if (sel === "trigger") {
      const t = draft.trigger;
      return (
        <div className="space-y-3">
          <div><h3 className="text-sm font-semibold">Gatilho</h3><p className="text-xs text-muted-foreground">O que faz essa automação começar.</p></div>
          <Lab label="Quando">
            <Sel value={t.type} options={Object.entries(TRIGGERS) as Array<[string, string]>}
              onChange={(e) => edit((d) => { const type = e.target.value as TriggerType; d.trigger = { type, ...(type === "stage" ? { stage: openStages[0]?.id } : {}) }; })} />
          </Lab>
          {t.type === "form" && (
            <Lab label="Formulário">
              <Sel value={t.formId ?? ""} options={[["", "Qualquer formulário"], ...forms.map((f): [string, string] => [f.id, f.name])]} onChange={(e) => setTrigger({ formId: e.target.value || undefined })} />
            </Lab>
          )}
          {t.type === "stage" && (
            <Lab label="Etapa">
              <Sel value={t.stage ?? ""} options={[["", "Escolher etapa"], ...openStages.map((s): [string, string] => [s.id, s.name])]} onChange={(e) => setTrigger({ stage: e.target.value || undefined })} />
            </Lab>
          )}
          {t.type === "idle" && (
            <Lab label="Dias sem movimento"><Input type="number" min={1} value={t.days ?? 7} onChange={(e) => setTrigger({ days: Math.max(1, Number(e.target.value) || 7) })} /></Lab>
          )}
          {t.type === "schedule" && (
            <>
              <Lab label="Quando rodar"><Input value={t.every ?? ""} placeholder="Ex.: todo dia 1º, para clientes ativos" onChange={(e) => setTrigger({ every: e.target.value })} /></Lab>
              <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">Gatilho por data ainda não executa sozinho. Dá para montar e testar o fluxo, mas ele não dispara no CRM por enquanto.</p>
            </>
          )}
          {t.type === "msg_in" && (
            <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">Dispara quando um contato novo chama no WhatsApp e vira lead no funil. Depende do WhatsApp estar conectado.</p>
          )}
        </div>
      );
    }
    if (!found) return <p className="text-sm text-muted-foreground">Clique num bloco para editar.</p>;
    const s = found.step;
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{BLOCKS[s.type].name}</h3>
        {s.type === "msg" && (
          <>
            <Lab label="Mensagem"><textarea rows={4} className={cn(inputCls, "resize-y")} value={s.text ?? ""} onChange={(e) => setStep({ text: e.target.value })} /></Lab>
            <p className="text-xs text-muted-foreground">Use {"{nome}"} e {"{empresa}"} para personalizar. Fora da janela de 24h do WhatsApp o envio pode ser recusado pelo provedor.</p>
          </>
        )}
        {s.type === "ask" && (
          <>
            <Lab label="Pergunta"><textarea rows={3} className={cn(inputCls, "resize-y")} value={s.text ?? ""} onChange={(e) => setStep({ text: e.target.value })} /></Lab>
            <Lab label="Opções (uma por linha; vazio = resposta livre)"><Lines key={s.id} value={s.options ?? []} onChange={(options) => setStep({ options })} /></Lab>
            <Lab label="Salvar resposta em"><Sel value={s.saveTo ?? ""} options={Object.entries(SAVE_TO) as Array<[string, string]>} onChange={(e) => setStep({ saveTo: e.target.value })} /></Lab>
            <p className="text-xs text-muted-foreground">A automação espera a resposta por até 3 dias e segue quando o lead responder.</p>
          </>
        )}
        {s.type === "cond" && (
          <>
            <Lab label="Verificar"><Sel value={s.field ?? "answer"} options={Object.entries(COND_FIELDS) as Array<[string, string]>} onChange={(e) => setStep({ field: e.target.value })} /></Lab>
            {s.field !== "replied" && <Lab label="Contém"><Input value={s.value ?? ""} onChange={(e) => setStep({ value: e.target.value })} /></Lab>}
            <p className="text-xs text-muted-foreground">Se for verdade, segue pelo caminho “Sim”. Se não, pelo “Não”.</p>
          </>
        )}
        {s.type === "wait" && (
          <>
            <Lab label="Esperar por">
              <Sel value={s.until ?? "resposta"} options={[["resposta", "Resposta do lead (com limite de tempo)"], ["tempo", "Um intervalo de tempo"]]} onChange={(e) => setStep({ until: e.target.value as Step["until"] })} />
            </Lab>
            <div className="grid grid-cols-2 gap-2">
              <Lab label="Quanto"><Input type="number" min={1} value={s.amount ?? 1} onChange={(e) => setStep({ amount: Math.max(1, Number(e.target.value) || 1) })} /></Lab>
              <Lab label="Unidade"><Sel value={s.unit ?? "dias"} options={[["horas", "horas"], ["dias", "dias"]]} onChange={(e) => setStep({ unit: e.target.value as Step["unit"] })} /></Lab>
            </div>
          </>
        )}
        {s.type === "tag" && <Lab label="Etiqueta"><Input value={s.tag ?? ""} onChange={(e) => setStep({ tag: e.target.value })} /></Lab>}
        {s.type === "deal" && (
          <>
            <Lab label="Mover para a etapa"><Sel value={s.stage ?? ""} options={[["", "Não mover"], ...openStages.map((x): [string, string] => [x.id, x.name])]} onChange={(e) => setStep({ stage: e.target.value })} /></Lab>
            <Lab label="Trocar responsável"><Sel value={s.owner ?? ""} options={[["", "Não trocar"], ...team.map((t): [string, string] => [t.user_id, t.display_name])]} onChange={(e) => setStep({ owner: e.target.value })} /></Lab>
          </>
        )}
        {s.type === "task" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Lab label="Tipo"><Sel value={s.ttype ?? "Tarefa"} options={ACTIVITY_TYPES.map((x): [string, string] => [x, x])} onChange={(e) => setStep({ ttype: e.target.value })} /></Lab>
              <Lab label="Daqui a (dias)"><Input type="number" min={0} value={s.days ?? 0} onChange={(e) => setStep({ days: Math.max(0, Number(e.target.value) || 0) })} /></Lab>
            </div>
            <Lab label="O que fazer"><Input value={s.title ?? ""} onChange={(e) => setStep({ title: e.target.value })} /></Lab>
            <Lab label="Quem"><Sel value={s.owner ?? "lead"} options={owners} onChange={(e) => setStep({ owner: e.target.value })} /></Lab>
          </>
        )}
        {s.type === "meet" && (
          <>
            <Lab label="Mensagem"><textarea rows={3} className={cn(inputCls, "resize-y")} value={s.text ?? ""} onChange={(e) => setStep({ text: e.target.value })} /></Lab>
            <Lab label="Horários oferecidos (um por linha)"><Lines key={s.id} rows={3} value={s.options ?? []} onChange={(options) => setStep({ options })} /></Lab>
            <p className="text-xs text-muted-foreground">O horário que o lead escolher vira uma atividade de reunião no CRM.</p>
          </>
        )}
        {s.type === "form" && (
          <>
            <Lab label="Formulário"><Sel value={s.formId ?? ""} options={[["", "Escolher formulário"], ...forms.map((f): [string, string] => [f.id, f.name])]} onChange={(e) => setStep({ formId: e.target.value || undefined })} /></Lab>
            {!s.formId && <p className="text-xs text-amber-600 dark:text-amber-400">Sem formulário escolhido, esse bloco não envia nada. Crie um em Formulários e volte aqui.</p>}
          </>
        )}
        {s.type === "human" && (
          <>
            <Lab label="Passar para"><Sel value={s.owner ?? "lead"} options={owners} onChange={(e) => setStep({ owner: e.target.value })} /></Lab>
            <p className="text-xs text-muted-foreground">As mensagens automáticas param quando uma pessoa assume a conversa.</p>
          </>
        )}
        <div className="pt-1">
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => { edit((d) => { const f = findStep(sel, d.steps); f?.list.splice(f.index, 1); }); setSel("trigger"); }}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir bloco
          </Button>
        </div>
      </div>
    );
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 gap-1" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Automações</Button>
          <Input value={draft.name} onChange={(e) => edit((d) => { d.name = e.target.value; })} aria-label="Nome da automação" className="h-9 w-[340px] max-w-full text-base font-semibold" />
          <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">{saveState === "pending" ? "Salvando…" : saveState === "saved" ? "Salvo" : ""}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSwitch on={row.active} onLabel="Ativa" offLabel="Pausada" onClick={toggle} />
          <Button variant="outline" size="sm" className="gap-1.5" disabled={saveTpl.isPending}
            onClick={() => saveTpl.mutate({ kind: "auto", name: draft.name, description: triggerText(draft.trigger, ctx), payload: { trigger: draft.trigger, steps: draft.steps } }, { onSuccess: () => toast("Salvo em Meus modelos") })}>
            <Save className="h-3.5 w-3.5" /> Salvar como modelo
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={duplicate} disabled={create.isPending}><Copy className="h-3.5 w-3.5" /> Duplicar</Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirm("delete")}><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
          <Button size="sm" className="gap-1.5" onClick={() => setTesting(true)}><FlaskConical className="h-3.5 w-3.5" /> Testar</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-2xl border border-border/50 bg-muted/20 p-6" onClick={() => setIns(null)}>
          <div className="flex min-w-fit flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button" onClick={() => { setSel("trigger"); setIns(null); }}
              className={cn("w-[300px] max-w-full rounded-xl border bg-primary/10 px-3.5 py-2.5 text-left transition hover:shadow-md", sel === "trigger" ? "border-primary ring-2 ring-primary/30" : "border-primary/40")}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary">Gatilho</span>
              <span className="mt-0.5 block text-sm">{triggerText(draft.trigger, ctx)}</span>
            </button>
            {renderList(draft.steps, "root", false)}
            {plus("root", draft.steps.length, false)}
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fim</span>
          </div>
        </div>
        <aside className="h-fit rounded-2xl border border-border/50 bg-card p-4 lg:sticky lg:top-4">{inspector}</aside>
      </div>

      <AutomationTest automation={current} open={testing} onClose={() => setTesting(false)} />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "delete" ? `Excluir “${draft.name}”?` : `Ativar “${draft.name}”?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "A automação e o histórico de execuções dela serão apagados. Os leads e as notas que ela já criou ficam como estão."
                : "Esta automação envia mensagens de verdade pelo WhatsApp conectado quando o gatilho acontecer. Use “Testar” antes se ainda não conferiu o fluxo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm === "delete" ? remove.mutate(id, { onSuccess: () => { toast("Automação excluída"); onBack(); } }) : activate()}
            >{confirm === "delete" ? "Excluir" : "Ativar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
