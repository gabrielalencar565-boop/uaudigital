import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FIELD_TYPES, type FormField } from "../lib/builder";

/** Cartão de modelo: o cartão inteiro abre a prévia ("como funciona"); os botões de dentro não. */
export function TemplateCard({ kind, title, desc, extra, onOpen, children }: { kind: string; title: string; desc?: string; extra?: string; onOpen: () => void; children: ReactNode }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-border/50 bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-card/80"
    >
      <span className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">{kind}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {children}
        <button type="button" className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={onOpen}>Ver como funciona</button>
      </div>
    </article>
  );
}

/** Mostra as perguntas do modelo de formulário, como a pessoa vai vê-las. */
export function FormPreview({ open, onClose, name, desc, fields, onUse, busy }: {
  open: boolean; onClose: () => void; name: string; desc?: string; fields: FormField[]; onUse: () => void; busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          {desc && <DialogDescription>{desc}</DialogDescription>}
        </DialogHeader>
        <ol className="space-y-2">
          {fields.map((f, i) => (
            <li key={f.id} className="flex gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm">{f.label}{f.required && <span className="text-destructive"> *</span>}</p>
                <p className="text-xs text-muted-foreground">{FIELD_TYPES[f.type]}{f.options.length ? ` · ${f.options.join(" · ")}` : ""}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Quem responder vira lead no funil. Ao usar o modelo, você recebe um rascunho para ajustar e publicar quando estiver pronto.</p>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={busy} onClick={() => { onUse(); onClose(); }}>Usar modelo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
