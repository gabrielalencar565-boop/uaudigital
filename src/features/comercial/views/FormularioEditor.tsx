import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, Copy, ExternalLink, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Lab, Sel, StatusSwitch, inputCls } from "../components/BuilderBits";
import { FormFields, type FormValues } from "../components/FormFields";
import { Panel } from "../components/ui-bits";
import { useComercial } from "../ComercialContext";
import { useAutosave } from "../hooks/use-autosave";
import { useAutomations, useDeleteForm, useForms, useSaveTemplate, useUpdateForm } from "../hooks/use-builder";
import { CONSENT_TEXT, FIELD_MAPS, FIELD_TYPES, PUBLIC_FORM_URL, clone, newId, type ComercialForm, type FieldType, type FormField } from "../lib/builder";
import { isOpenStage } from "../lib/rules";

type Draft = Pick<ComercialForm, "name" | "description" | "fields" | "dest" | "thanks">;

function OptionLines({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <textarea rows={3} value={text} className={cn(inputCls, "resize-y")}
      onChange={(e) => { setText(e.target.value); onChange(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean)); }} />
  );
}

export function FormularioEditor({ id, onBack, onFill }: { id: string; onBack: () => void; onFill: (f: ComercialForm) => void }) {
  const { stages, team } = useComercial();
  const formsQ = useForms();
  const autos = useAutomations().data ?? [];
  const update = useUpdateForm();
  const remove = useDeleteForm();
  const saveTpl = useSaveTemplate();
  const row = formsQ.data?.find((f) => f.id === id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<"delete" | null>(null);
  const [preview, setPreview] = useState<FormValues>({});

  useEffect(() => {
    if (row && !draft) setDraft({ name: row.name, description: row.description, fields: clone(row.fields), dest: clone(row.dest), thanks: row.thanks });
  }, [row, draft]);

  const saveState = useAutosave(draft, (d) => update.mutate({ id, patch: { ...d, name: d.name.trim() || "Formulário" } }));
  const edit = (fn: (d: Draft) => void) => setDraft((p) => { if (!p) return p; const c = clone(p); fn(c); return c; });

  const linked = useMemo(() => autos.filter((a) => a.trigger.type === "form" && (!a.trigger.formId || a.trigger.formId === id)), [autos, id]);
  const openStages = stages.filter(isOpenStage);

  if (formsQ.isLoading || (row && !draft)) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!row || !draft) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="gap-1" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Formulários</Button>
        <p className="text-sm text-muted-foreground">Esse formulário não existe mais.</p>
      </div>
    );
  }

  const link = `${PUBLIC_FORM_URL}${row.slug}`;
  const setField = (i: number, patch: Partial<FormField>) => edit((d) => { Object.assign(d.fields[i], patch); });
  const move = (i: number, j: number) => edit((d) => { [d.fields[i], d.fields[j]] = [d.fields[j], d.fields[i]]; });
  const addField = (type: FieldType) => {
    const f: FormField = { id: newId(), type, label: type === "consent" ? CONSENT_TEXT : "Nova pergunta", required: false, options: type === "choice" || type === "multi" ? ["Opção 1", "Opção 2"] : [], map: "" };
    edit((d) => { d.fields.push(f); });
    setTimeout(() => { const el = document.getElementById(`fq-l-${f.id}`) as HTMLInputElement | null; el?.scrollIntoView({ block: "center" }); el?.select(); });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 gap-1" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Formulários</Button>
          <Input value={draft.name} onChange={(e) => edit((d) => { d.name = e.target.value; })} aria-label="Nome do formulário" className="h-9 w-[340px] max-w-full text-base font-semibold" />
          <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">{saveState === "pending" ? "Salvando…" : saveState === "saved" ? "Salvo" : ""}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSwitch on={row.active} onLabel="Publicado" offLabel="Rascunho" onClick={() => update.mutate({ id, patch: { active: !row.active } }, { onSuccess: () => toast(row.active ? "Formulário voltou para rascunho" : "Formulário publicado") })} />
          <Button variant="outline" size="sm" className="gap-1.5" disabled={saveTpl.isPending}
            onClick={() => saveTpl.mutate({ kind: "form", name: draft.name, description: draft.description, payload: { fields: draft.fields } }, { onSuccess: () => toast("Salvo em Meus modelos") })}>
            <Save className="h-3.5 w-3.5" /> Salvar como modelo
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirm("delete")}><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
          <Button size="sm" onClick={() => onFill({ ...row, ...draft })}>Preencher (teste)</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <Panel><Lab label="Descrição"><Input value={draft.description} onChange={(e) => edit((d) => { d.description = e.target.value; })} /></Lab></Panel>

          {draft.fields.map((f, i) => (
            <Panel key={f.id}>
              <div className="flex items-center gap-2">
                <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <Input id={`fq-l-${f.id}`} value={f.label} onChange={(e) => setField(i, { label: e.target.value })} aria-label="Pergunta" className="flex-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} aria-label="Subir" onClick={() => move(i, i - 1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === draft.fields.length - 1} aria-label="Descer" onClick={() => move(i, i + 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Excluir pergunta" onClick={() => edit((d) => { d.fields.splice(i, 1); })}><X className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Lab label="Tipo">
                  <Sel value={f.type} options={Object.entries(FIELD_TYPES) as Array<[string, string]>}
                    onChange={(e) => { const type = e.target.value as FieldType; setField(i, { type, options: (type === "choice" || type === "multi") && !f.options.length ? ["Opção 1", "Opção 2"] : f.options }); }} />
                </Lab>
                <Lab label="Salvar no lead"><Sel value={f.map} options={Object.entries(FIELD_MAPS) as Array<[string, string]>} onChange={(e) => setField(i, { map: e.target.value })} /></Lab>
                <Lab label="Obrigatória"><Sel value={f.required ? "1" : ""} options={[["1", "Sim"], ["", "Não"]]} onChange={(e) => setField(i, { required: !!e.target.value })} /></Lab>
              </div>
              {(f.type === "choice" || f.type === "multi") && (
                <Lab label="Opções (uma por linha)" className="mt-2"><OptionLines key={f.id + f.type} value={f.options} onChange={(options) => setField(i, { options })} /></Lab>
              )}
            </Panel>
          ))}

          <Panel title="Adicionar pergunta">
            <div className="flex flex-wrap gap-2">
              {(Object.entries(FIELD_TYPES) as Array<[FieldType, string]>).map(([k, t]) => <Button key={k} variant="outline" size="sm" onClick={() => addField(k)}>{t}</Button>)}
            </div>
          </Panel>

          <Panel title="Quando alguém enviar">
            <label className="mb-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-violet-500" checked={draft.dest.create} onChange={(e) => edit((d) => { d.dest.create = e.target.checked; })} />
              <span>Criar ou atualizar o lead no CRM (sem duplicar: procura pelo WhatsApp e pelo e-mail)</span>
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Lab label="Etapa do funil"><Sel value={draft.dest.stage_id ?? ""} options={[["", "Primeira etapa"], ...openStages.map((s): [string, string] => [s.id, s.name])]} onChange={(e) => edit((d) => { d.dest.stage_id = e.target.value || null; })} /></Lab>
              <Lab label="Responsável"><Sel value={draft.dest.owner_id ?? ""} options={[["", "Sem responsável"], ...team.map((t): [string, string] => [t.user_id, t.display_name])]} onChange={(e) => edit((d) => { d.dest.owner_id = e.target.value || null; })} /></Lab>
              <Lab label="Etiqueta"><Input value={draft.dest.tag} onChange={(e) => edit((d) => { d.dest.tag = e.target.value; })} /></Lab>
            </div>
            <Lab label="Mensagem de confirmação" className="mt-3"><Input value={draft.thanks} onChange={(e) => edit((d) => { d.thanks = e.target.value; })} /></Lab>
            <p className="mt-3 text-xs text-muted-foreground">
              {linked.length
                ? linked.map((a) => <span key={a.id} className="block">Automação ligada: <b>{a.name}</b> ({a.active ? "ativa" : "pausada"})</span>)
                : "Nenhuma automação ligada a esse formulário. Crie uma com o gatilho “Formulário enviado”."}
            </p>
          </Panel>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Panel title="Link público">
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted/50 px-2 py-1.5 text-xs">{link}</code>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => navigator.clipboard?.writeText(link).then(() => toast("Link copiado"), () => toast(link))}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
              <Button size="sm" variant="outline" asChild><a href={link} target="_blank" rel="noreferrer" aria-label="Abrir link"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
            </div>
            {!row.active && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Rascunho: o link só funciona depois de publicar.</p>}
          </Panel>
          <Panel title="Prévia">
            <h4 className="text-base font-semibold">{draft.name}</h4>
            {draft.description && <p className="mb-3 text-xs text-muted-foreground">{draft.description}</p>}
            <div className="mt-3"><FormFields fields={draft.fields} values={preview} onChange={(fid, v) => setPreview((p) => ({ ...p, [fid]: v }))} /></div>
            <Button className="mt-4 w-full" disabled>Enviar respostas</Button>
          </Panel>
        </aside>
      </div>

      <AlertDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{draft.name}”?</AlertDialogTitle>
            <AlertDialogDescription>O link público deixa de funcionar e as respostas deste formulário serão apagadas. Os leads que ele criou continuam no funil.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(id, { onSuccess: () => { toast("Formulário excluído"); onBack(); } })}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
