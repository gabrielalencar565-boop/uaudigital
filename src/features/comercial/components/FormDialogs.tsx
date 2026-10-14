import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useComercial } from "../ComercialContext";
import { useFormResponses } from "../hooks/use-builder";
import type { ComercialForm } from "../lib/builder";
import { FormFields, answersByLabel, firstMissing, type FormValues } from "./FormFields";
import { fmtDateTime } from "./BuilderBits";

const EXAMPLE: Record<string, string> = { name: "Larissa Campos", company: "Campos Estética", phone: "(99) 98111-2233", email: "larissa@camposestetica.com.br", segment: "Estética", ig: "@camposestetica", city: "Imperatriz" };

/** "Preencher (teste)": mostra o formulário como quem recebe o link vê. Não grava resposta nem cria lead. */
export function FillDialog({ form, onClose }: { form: ComercialForm | null; onClose: () => void }) {
  const [values, setValues] = useState<FormValues>({});
  const [sent, setSent] = useState(false);
  const reset = () => { setValues({}); setSent(false); };
  const close = () => { reset(); onClose(); };

  const example = () => {
    if (!form) return;
    const v: FormValues = {};
    for (const f of form.fields) {
      if (f.type === "file") continue;
      if (f.type === "choice" || f.type === "scale") v[f.id] = f.type === "scale" ? "9" : f.options[Math.min(1, f.options.length - 1)] ?? "";
      else if (f.type === "multi") v[f.id] = f.options.slice(0, 2).join(", ");
      else if (f.type === "consent") v[f.id] = "Sim";
      else v[f.id] = EXAMPLE[f.map] ?? (f.type === "long" ? "Queremos atrair mais clientes pelo Instagram." : f.type === "date" ? "2026-11-20" : f.type === "number" ? "3" : "Resposta de exemplo");
    }
    setValues(v);
  };

  const submit = () => {
    if (!form) return;
    const missing = firstMissing(form.fields, values);
    if (missing) return toast(`Responda: ${missing}`);
    setSent(true);
  };

  return (
    <Dialog open={!!form} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {form && (sent ? (
          <>
            <DialogHeader><DialogTitle>Obrigado!</DialogTitle><DialogDescription>{form.thanks}</DialogDescription></DialogHeader>
            <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">Isto foi só um teste: nenhuma resposta foi gravada e nenhum lead foi criado. Para testar de verdade, abra o link público do formulário.</p>
            <DialogFooter><Button variant="outline" onClick={reset}>Preencher de novo</Button><Button onClick={close}>Fechar</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{form.name}</DialogTitle>
              <DialogDescription>{form.description || "Visão de quem recebe o link. Teste: nada é gravado."}</DialogDescription>
            </DialogHeader>
            <FormFields fields={form.fields} values={values} onChange={(id, v) => setValues((p) => ({ ...p, [id]: v }))} />
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={example}>Preencher com exemplo</Button>
              <Button onClick={submit}>Enviar respostas</Button>
            </DialogFooter>
          </>
        ))}
      </DialogContent>
    </Dialog>
  );
}

export function ResponsesDialog({ form, onClose }: { form: ComercialForm | null; onClose: () => void }) {
  const { leadOf, openLead } = useComercial();
  const all = useFormResponses().data ?? [];
  const rows = form ? all.filter((r) => r.form_id === form.id) : [];
  const cols = form ? form.fields.filter((f) => f.type !== "consent" && f.type !== "file").slice(0, 5) : [];

  return (
    <Dialog open={!!form} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Respostas: {form?.name}</DialogTitle><DialogDescription>{rows.length} resposta{rows.length === 1 ? "" : "s"}. Clique numa linha para abrir o lead.</DialogDescription></DialogHeader>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma resposta ainda.</div>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-border/50">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Data</th>
                  {cols.map((c) => <th key={c.id} className="px-3 py-2 font-medium">{c.label}</th>)}
                  <th className="px-3 py-2 font-medium">Lead</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const lead = r.lead_id ? leadOf(r.lead_id) : undefined;
                  return (
                    <tr key={r.id} onClick={() => { if (lead) { onClose(); openLead(lead.id); } }} className={lead ? "cursor-pointer border-b border-border/30 hover:bg-muted/30" : "border-b border-border/30"}>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{fmtDateTime(r.submitted_at)}</td>
                      {cols.map((c) => <td key={c.id} className="max-w-[220px] truncate px-3 py-2">{r.answers[c.label] || "—"}</td>)}
                      <td className="px-3 py-2">{lead?.name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { answersByLabel };
