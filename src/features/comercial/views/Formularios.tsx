import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FillDialog, ResponsesDialog } from "../components/FormDialogs";
import { PageHead } from "../components/ui-bits";
import { useComercial } from "../ComercialContext";
import { useCreateForm, useFormResponses, useForms } from "../hooks/use-builder";
import { PUBLIC_FORM_URL, emptyDest, makeSlug, newId, type ComercialForm } from "../lib/builder";
import { cn } from "@/lib/utils";
import { FormularioEditor } from "./FormularioEditor";

export function Formularios() {
  const [params, setParams] = useSearchParams();
  const formId = params.get("form");
  const { goto } = useComercial();
  const forms = useForms();
  const responses = useFormResponses().data ?? [];
  const create = useCreateForm();
  const [fill, setFill] = useState<ComercialForm | null>(null);
  const [resp, setResp] = useState<ComercialForm | null>(null);

  const open = (id: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set("form", id); else n.delete("form"); return n; }, { replace: true });

  const stats = useMemo(() => {
    const m = new Map<string, { n: number; leads: Set<string> }>();
    for (const r of responses) {
      const e = m.get(r.form_id) ?? { n: 0, leads: new Set<string>() };
      e.n++; if (r.lead_id) e.leads.add(r.lead_id);
      m.set(r.form_id, e);
    }
    return m;
  }, [responses]);

  if (formId) return <FormularioEditor key={formId} id={formId} onBack={() => open(null)} onFill={setFill} />;

  const list = forms.data ?? [];
  const blank = () => create.mutate({
    key: "blank", name: "Novo formulário", description: "", active: false, dest: emptyDest(), slug: makeSlug("formulario"),
    fields: [{ id: newId(), type: "text", label: "Seu nome", required: true, options: [], map: "name" }],
    thanks: "Recebemos suas respostas! Nossa equipe vai te chamar em breve.",
  }, { onSuccess: (f) => open(f.id) });

  return (
    <div className="space-y-4">
      <PageHead
        title="Formulários"
        subtitle="Cada formulário tem um link público. Quem responde vira lead no funil, sem duplicar contato."
        right={<>
          <Button variant="outline" size="sm" onClick={() => goto("lib")}>Biblioteca de modelos</Button>
          <Button size="sm" className="gap-1.5" disabled={create.isPending} onClick={blank}><Plus className="h-4 w-4" /> Novo formulário</Button>
        </>}
      />

      {forms.isLoading ? null : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 px-6 py-12 text-center">
          <h3 className="text-base font-semibold">Nenhum formulário ainda</h3>
          <p className="max-w-md text-sm text-muted-foreground">Use um modelo pronto (captação, diagnóstico, briefing, satisfação…) ou crie um do zero.</p>
          <Button variant="outline" onClick={() => goto("lib")}>Ver biblioteca de modelos</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((f) => {
            const s = stats.get(f.id);
            return (
              <article key={f.id} className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{f.name}</h3>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", f.active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{f.active ? "publicado" : "rascunho"}</span>
                </div>
                <p className="min-h-[2lh] text-xs text-muted-foreground">{f.description || "Sem descrição."}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span><b className="tabular-nums text-foreground">{f.fields.length}</b> {f.fields.length === 1 ? "pergunta" : "perguntas"}</span>
                  <span><b className="tabular-nums text-foreground">{s?.n ?? 0}</b> {s?.n === 1 ? "resposta" : "respostas"}</span>
                  <span><b className="tabular-nums text-foreground">{s?.leads.size ?? 0}</b> {s?.leads.size === 1 ? "lead" : "leads"}</span>
                </div>
                <code className="truncate rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">{PUBLIC_FORM_URL.replace("https://", "")}{f.slug}</code>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => open(f.id)}>Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => setFill(f)}>Preencher (teste)</Button>
                  <Button size="sm" variant="outline" onClick={() => setResp(f)}>Respostas</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <FillDialog form={fill} onClose={() => setFill(null)} />
      <ResponsesDialog form={resp} onClose={() => setResp(null)} />
    </div>
  );
}
