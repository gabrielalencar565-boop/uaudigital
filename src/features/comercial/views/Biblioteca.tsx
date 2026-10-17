import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TemplateCard } from "../components/TemplatePreview";
import { PageHead } from "../components/ui-bits";
import { useComercial } from "../ComercialContext";
import { useCreateAutomation, useDeleteTemplate, useForms, useMyTemplates } from "../hooks/use-builder";
import { AUTO_TPL, clone, linkFormSteps, reid, type SavedTemplate, type Step, type Trigger } from "../lib/builder";
import { triggerText } from "../lib/summary";
import { AutomacaoPreview } from "./AutomacaoPreview";

interface Preview { name: string; desc?: string; trigger: Trigger; steps: Step[] }

export function Biblioteca() {
  const [, setParams] = useSearchParams();
  const { stages, team, goto } = useComercial();
  const forms = useForms().data ?? [];
  const mine = (useMyTemplates().data ?? []).filter((t) => t.kind === "auto");
  const createAuto = useCreateAutomation();
  const delTpl = useDeleteTemplate();
  const [preview, setPreview] = useState<Preview | null>(null);

  const tctx = { stageByName: (n: string) => stages.find((s) => s.name === n)?.id ?? "" };
  const sctx = { stages, team, forms };
  const goEdit = (id: string) => setParams({ v: "autos", edit: id }, { replace: true });

  const applyAuto = (name: string, trigger: Trigger, steps: Step[]) => {
    const linked = linkFormSteps(steps, forms);
    const missing = linked.some(function miss(s: Step): boolean { return (s.type === "form" && !s.formId) || (s.type === "cond" && ([...(s.yes ?? []), ...(s.no ?? [])]).some(miss)); });
    createAuto.mutate({ name, trigger, steps: linked }, {
      onSuccess: (a) => {
        toast(missing ? "Modelo copiado. Escolha o formulário no bloco de envio e ative quando estiver pronto." : "Modelo copiado (pausado). Ajuste e ative quando estiver pronto.");
        goEdit(a.id);
      },
    });
  };

  const applyMine = (t: SavedTemplate) => {
    const p = t.payload as { trigger: Trigger; steps: Step[] };
    applyAuto(t.name, clone(p.trigger), reid(clone(p.steps)));
  };

  const busy = createAuto.isPending;

  if (preview) {
    return (
      <AutomacaoPreview
        key={preview.name}
        name={preview.name}
        desc={preview.desc}
        trigger={preview.trigger}
        steps={linkFormSteps(preview.steps, forms)}
        busy={busy}
        onBack={() => setPreview(null)}
        onUse={() => applyAuto(preview.name, preview.trigger, preview.steps)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHead title="Biblioteca de modelos" subtitle="Use um modelo para não começar do zero. Clique em um modelo para ver como ele funciona. Ele vira uma cópia sua, pausada, para você ajustar antes de ativar. Os modelos não levam dados de nenhum cliente." />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Automações</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(AUTO_TPL).map(([k, t]) => {
            const trigger = t.trigger(tctx);
            const steps = t.steps(tctx);
            return (
              <TemplateCard key={k} kind="Automação" title={t.name} desc={t.desc} extra={`Gatilho: ${triggerText(trigger, sctx)}`} onOpen={() => setPreview({ name: t.name, desc: t.desc, trigger, steps })}>
                <Button size="sm" disabled={busy} onClick={() => applyAuto(t.name, trigger, steps)}>Usar modelo</Button>
              </TemplateCard>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Meus modelos</h3>
        {mine.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">Nenhum ainda. No editor de uma automação, clique em “Salvar como modelo”.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((t) => {
              const p = t.payload as { trigger: Trigger; steps: Step[] };
              return (
                <TemplateCard key={t.id} kind="Automação" title={t.name} desc={t.description} onOpen={() => setPreview({ name: t.name, desc: t.description, trigger: p.trigger, steps: p.steps })}>
                  <Button size="sm" disabled={busy} onClick={() => applyMine(t)}>Usar modelo</Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => delTpl.mutate(t.id, { onSuccess: () => toast("Modelo removido") })}><Trash2 className="h-3.5 w-3.5" /> Remover</Button>
                </TemplateCard>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">Procurando modelos de formulário? Eles ficam na aba <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => goto("forms")}>Formulários</button>.</p>

    </div>
  );
}
