import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHead } from "../components/ui-bits";
import { useComercial } from "../ComercialContext";
import { useCreateAutomation, useCreateForm, useDeleteTemplate, useForms, useMyTemplates } from "../hooks/use-builder";
import {
  AUTO_TPL, FORM_TPL, clone, emptyDest, linkFormSteps, makeSlug, newId, reid,
  type FormField, type SavedTemplate, type Step, type Trigger,
} from "../lib/builder";
import { triggerText } from "../lib/summary";

function Card({ kind, title, desc, extra, children }: { kind: string; title: string; desc?: string; extra?: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-card p-4">
      <span className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">{kind}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">{children}</div>
    </article>
  );
}

export function Biblioteca() {
  const [, setParams] = useSearchParams();
  const { stages, team } = useComercial();
  const forms = useForms().data ?? [];
  const mine = useMyTemplates().data ?? [];
  const createAuto = useCreateAutomation();
  const createForm = useCreateForm();
  const delTpl = useDeleteTemplate();

  const tctx = { stageByName: (n: string) => stages.find((s) => s.name === n)?.id ?? "" };
  const sctx = { stages, team, forms };
  const goEdit = (view: "autos" | "forms", key: "edit" | "form", id: string) => setParams({ v: view, [key]: id }, { replace: true });

  const applyAuto = (name: string, trigger: Trigger, steps: Step[]) => {
    const linked = linkFormSteps(steps, forms);
    const missing = linked.some(function miss(s: Step): boolean { return (s.type === "form" && !s.formId) || (s.type === "cond" && ([...(s.yes ?? []), ...(s.no ?? [])]).some(miss)); });
    createAuto.mutate({ name, trigger, steps: linked }, {
      onSuccess: (a) => {
        toast(missing ? "Modelo copiado. Escolha o formulário no bloco de envio e ative quando estiver pronto." : "Modelo copiado (pausado). Ajuste e ative quando estiver pronto.");
        goEdit("autos", "edit", a.id);
      },
    });
  };

  const applyForm = (key: string, name: string, description: string, fields: FormField[]) => {
    const first = stages.find((s) => s.type === "open");
    createForm.mutate({
      key, name, description, active: false, slug: makeSlug(name), fields,
      dest: { ...emptyDest(), stage_id: first?.id ?? null }, thanks: "Recebemos suas respostas! Nossa equipe vai te chamar em breve.",
    }, { onSuccess: (f) => { toast("Modelo copiado (rascunho). Ajuste e publique quando estiver pronto."); goEdit("forms", "form", f.id); } });
  };

  const applyMine = (t: SavedTemplate) => {
    if (t.kind === "auto") {
      const p = t.payload as { trigger: Trigger; steps: Step[] };
      applyAuto(t.name, clone(p.trigger), reid(clone(p.steps)));
    } else {
      const p = t.payload as { fields: FormField[] };
      applyForm("custom", t.name, t.description, clone(p.fields).map((f) => ({ ...f, id: newId() })));
    }
  };

  const busy = createAuto.isPending || createForm.isPending;

  return (
    <div className="space-y-6">
      <PageHead title="Biblioteca de modelos" subtitle="Use um modelo para não começar do zero. Ele vira uma cópia sua, pausada, para você ajustar antes de ativar. Os modelos não levam dados de nenhum cliente." />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Automações</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(AUTO_TPL).map(([k, t]) => {
            const trigger = t.trigger(tctx);
            return (
              <Card key={k} kind="Automação" title={t.name} desc={t.desc} extra={`Gatilho: ${triggerText(trigger, sctx)}`}>
                <Button size="sm" disabled={busy} onClick={() => applyAuto(t.name, trigger, t.steps(tctx))}>Usar modelo</Button>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Formulários</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(FORM_TPL).map(([k, t]) => (
            <Card key={k} kind="Formulário" title={t.name} desc={t.desc}>
              <Button size="sm" disabled={busy} onClick={() => applyForm(k, t.name, t.desc, t.fields())}>Usar modelo</Button>
            </Card>
          ))}
          <Card kind="Formulário" title="Em branco" desc="Comece só com o campo de nome.">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => applyForm("blank", "Novo formulário", "", [{ id: newId(), type: "text", label: "Seu nome", required: true, options: [], map: "name" }])}>Criar</Button>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Meus modelos</h3>
        {mine.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">Nenhum ainda. No editor de uma automação ou formulário, clique em “Salvar como modelo”.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((t) => (
              <Card key={t.id} kind={t.kind === "auto" ? "Automação" : "Formulário"} title={t.name} desc={t.description}>
                <Button size="sm" disabled={busy} onClick={() => applyMine(t)}>Usar modelo</Button>
                <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => delTpl.mutate(t.id, { onSuccess: () => toast("Modelo removido") })}><Trash2 className="h-3.5 w-3.5" /> Remover</Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
