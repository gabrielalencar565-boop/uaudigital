import { useMemo, useState } from "react";
import { ChevronLeft, Copy, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AutomationTest } from "../components/AutomationTest";
import { useComercial } from "../ComercialContext";
import { useForms } from "../hooks/use-builder";
import { BLOCKS, COND_FIELDS, SAVE_TO, TRIGGERS, findStep, type ComercialAutomation, type Step, type Trigger } from "../lib/builder";
import { blockSummary, ownerName, triggerText } from "../lib/summary";

const GROUP_TONE: Record<string, string> = { msg: "border-l-violet-500", logic: "border-l-amber-500", act: "border-l-emerald-500" };

/** Prévia de um modelo de automação: o mesmo desenho do editor, só para olhar. Nada é salvo até clicar em "Usar modelo". */
export function AutomacaoPreview({ name, desc, trigger, steps, onBack, onUse, busy }: {
  name: string; desc?: string; trigger: Trigger; steps: Step[]; onBack: () => void; onUse: () => void; busy?: boolean;
}) {
  const { stages, team } = useComercial();
  const forms = useForms().data ?? [];
  const ctx = useMemo(() => ({ stages, team, forms }), [stages, team, forms]);
  const [sel, setSel] = useState<string>("trigger");
  const [testing, setTesting] = useState(false);
  const fake: ComercialAutomation = { id: "preview", name, active: false, trigger, steps, runs: 0, last_run_at: null, created_at: new Date().toISOString() };

  const node = (s: Step) => {
    const sum = blockSummary(s, ctx);
    return (
      <button
        type="button" onClick={() => setSel(s.id)}
        className={cn("w-[300px] max-w-full rounded-xl border border-l-4 bg-card px-3.5 py-2.5 text-left transition hover:shadow-md", GROUP_TONE[BLOCKS[s.type].group], sel === s.id ? "border-primary ring-2 ring-primary/30" : "border-border/60")}
      >
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{BLOCKS[s.type].name}</span>
        <span className="mt-0.5 block break-words text-sm">{sum.main}</span>
        {sum.sub && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{sum.sub}</span>}
      </button>
    );
  };

  const line = <div className="h-4 w-px bg-border" />;

  const renderList = (list: Step[]): React.ReactNode => (
    <>
      {list.map((s) => (
        <div key={s.id} className="flex flex-col items-center">
          {line}
          {node(s)}
          {s.type === "cond" && (
            <>
              {line}
              <div className="flex items-start gap-4">
                {(["yes", "no"] as const).map((br) => (
                  <div key={br} className="flex flex-col items-center rounded-xl border border-dashed border-border/70 px-3 pb-3 pt-1.5">
                    <span className={cn("rounded-full px-2 py-px text-[10px] font-semibold uppercase", br === "yes" ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500")}>{br === "yes" ? "Sim" : "Não"}</span>
                    {renderList((br === "yes" ? s.yes : s.no) ?? [])}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );

  const stageName = (id?: string) => stages.find((x) => x.id === id)?.name;
  const found = sel === "trigger" ? null : findStep(sel, steps)?.step ?? null;

  const rows = (s: Step): Array<[string, string]> => {
    switch (s.type) {
      case "msg": return [["Mensagem", s.text ?? ""]];
      case "ask": return [["Pergunta", s.text ?? ""], ["Opções", s.options?.length ? s.options.join(" · ") : "Resposta livre"], ["Salvar resposta em", SAVE_TO[s.saveTo ?? ""] ?? "Só guardar a resposta"]];
      case "cond": return [["Verificar", COND_FIELDS[s.field ?? "answer"]], ...(s.field !== "replied" ? [["Contém", s.value ?? ""] as [string, string]] : [])];
      case "wait": return [["Esperar por", s.until === "resposta" ? "Resposta do lead (com limite de tempo)" : "Um intervalo de tempo"], ["Quanto", `${s.amount ?? 1} ${s.unit ?? "dias"}`]];
      case "tag": return [["Etiqueta", s.tag ?? ""]];
      case "deal": return [["Mover para a etapa", stageName(s.stage) ?? "Não mover"], ["Trocar responsável", s.owner ? ownerName(s.owner, ctx) : "Não trocar"]];
      case "task": return [["Tipo", s.ttype ?? "Tarefa"], ["Daqui a", s.days ? `${s.days} dia${s.days > 1 ? "s" : ""}` : "Hoje"], ["O que fazer", s.title ?? ""], ["Quem", ownerName(s.owner, ctx)]];
      case "meet": return [["Mensagem", s.text ?? ""], ["Horários oferecidos", (s.options ?? []).join(" · ")]];
      case "form": return [["Formulário", forms.find((f) => f.id === s.formId)?.name ?? "Você escolhe ao usar o modelo"]];
      case "human": return [["Passar para", ownerName(s.owner, ctx)]];
    }
  };

  const help: Partial<Record<Step["type"], string>> = {
    msg: "Use {nome} e {empresa} para personalizar. Fora da janela de 24h do WhatsApp o envio pode ser recusado pelo provedor.",
    ask: "A automação espera a resposta por até 3 dias e segue quando o lead responder.",
    cond: "Se for verdade, segue pelo caminho “Sim”. Se não, pelo “Não”.",
    meet: "O horário que o lead escolher vira uma atividade de reunião no CRM.",
    human: "As mensagens automáticas param quando uma pessoa assume a conversa.",
  };

  const Field = ({ k, v }: { k: string; v: string }) => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className="whitespace-pre-wrap break-words rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">{v || "—"}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 gap-1" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Biblioteca</Button>
          <h2 className="truncate text-base font-semibold">{name}</h2>
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">Modelo · só para ver</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTesting(true)}><FlaskConical className="h-3.5 w-3.5" /> Testar</Button>
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={onUse}><Copy className="h-3.5 w-3.5" /> Usar modelo</Button>
        </div>
      </div>
      {desc && <p className="text-sm text-muted-foreground">{desc} Clique nos blocos para ver os detalhes. “Usar modelo” cria uma cópia pausada para você ajustar antes de ativar.</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-2xl border border-border/50 bg-muted/20 p-6">
          <div className="flex min-w-fit flex-col items-center">
            <button
              type="button" onClick={() => setSel("trigger")}
              className={cn("w-[300px] max-w-full rounded-xl border bg-primary/10 px-3.5 py-2.5 text-left transition hover:shadow-md", sel === "trigger" ? "border-primary ring-2 ring-primary/30" : "border-primary/40")}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary">Gatilho</span>
              <span className="mt-0.5 block text-sm">{triggerText(trigger, ctx)}</span>
            </button>
            {renderList(steps)}
            {line}
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fim</span>
          </div>
        </div>
        <aside className="h-fit space-y-3 rounded-2xl border border-border/50 bg-card p-4 lg:sticky lg:top-4">
          {sel === "trigger" || !found ? (
            <>
              <div><h3 className="text-sm font-semibold">Gatilho</h3><p className="text-xs text-muted-foreground">O que faz essa automação começar.</p></div>
              <Field k="Quando" v={TRIGGERS[trigger.type]} />
              {trigger.type === "stage" && <Field k="Etapa" v={stageName(trigger.stage) ?? "Você escolhe ao usar o modelo"} />}
              {trigger.type === "schedule" && <Field k="Quando rodar" v={trigger.every ?? ""} />}
              {trigger.type === "msg_back" && <Field k="Depois de quantas horas sem falar" v={String(trigger.hours ?? 24)} />}
              {trigger.type === "msg_back" && <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">Dispara quando alguém que já é lead escreve de novo no WhatsApp, depois de ficar esse tempo sem falar. Não repete enquanto essa automação ainda estiver rodando ou esperando para o mesmo lead.</p>}
              {trigger.type === "msg_in" && <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">Dispara quando um contato novo chama no WhatsApp e vira lead no funil. Depende do WhatsApp estar conectado.</p>}
              {trigger.type === "schedule" && <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">Gatilho por data ainda não executa sozinho. Dá para montar e testar o fluxo, mas ele não dispara no CRM por enquanto.</p>}
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold">{BLOCKS[found.type].name}</h3>
              {rows(found).map(([k, v]) => <Field key={k} k={k} v={v} />)}
              {help[found.type] && <p className="text-xs text-muted-foreground">{help[found.type]}</p>}
            </>
          )}
        </aside>
      </div>

      <AutomationTest automation={fake} open={testing} onClose={() => setTesting(false)} />
    </div>
  );
}
