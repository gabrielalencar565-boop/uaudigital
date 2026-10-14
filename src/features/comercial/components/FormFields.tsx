import { cn } from "@/lib/utils";
import type { FormField } from "../lib/builder";

// As perguntas de um formulário, iguais na prévia do editor, no "Preencher (teste)" e na página pública. Os valores ficam por id da pergunta;
// "multi" guarda as opções separadas por vírgula e "consent" guarda "Sim".

export type FormValues = Record<string, string>;

const MULTI_SEP = ", ";
export const toggleMulti = (current: string, option: string): string => {
  const set = current ? current.split(MULTI_SEP) : [];
  return (set.includes(option) ? set.filter((o) => o !== option) : [...set, option]).join(MULTI_SEP);
};

/** Respostas por pergunta (rótulo → texto), só as preenchidas: é o que o banco recebe. */
export function answersByLabel(fields: FormField[], values: FormValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f.id] ?? "").trim();
    if (v && f.type !== "file") out[f.label] = v;
  }
  return out;
}

/** Rótulo da primeira pergunta obrigatória sem resposta (arquivo não conta, ele ainda não é enviado). */
export function firstMissing(fields: FormField[], values: FormValues): string | null {
  const f = fields.find((x) => x.required && x.type !== "file" && !(values[x.id] ?? "").trim());
  return f ? f.label : null;
}

const INPUT_TYPES: Partial<Record<FormField["type"], string>> = { phone: "tel", email: "email", number: "number", date: "date" };

export function FormFields({ fields, values, onChange, variant = "app", disabled }: {
  fields: FormField[]; values: FormValues; onChange: (id: string, value: string) => void; variant?: "app" | "public"; disabled?: boolean;
}) {
  const pub = variant === "public";
  const inputCls = pub
    ? "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/30"
    : "w-full rounded-[10px] border border-border/50 bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/40";
  const legend = pub ? "text-sm text-white/70" : "text-xs text-muted-foreground";
  const option = pub ? "flex items-center gap-2.5 text-sm text-white/90" : "flex items-center gap-2 text-sm";
  const star = <span className={cn("ml-0.5", pub ? "text-rose-400" : "text-destructive")}>*</span>;

  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => {
        const v = values[f.id] ?? "";
        const label = <>{f.label}{f.required && star}</>;
        switch (f.type) {
          case "long":
            return (
              <label key={f.id} className="flex flex-col gap-1.5"><span className={legend}>{label}</span>
                <textarea rows={3} value={v} disabled={disabled} onChange={(e) => onChange(f.id, e.target.value)} className={cn(inputCls, "resize-y")} />
              </label>
            );
          case "choice":
            return (
              <fieldset key={f.id} className="flex flex-col gap-2"><legend className={cn(legend, "mb-1")}>{label}</legend>
                {f.options.map((o) => (
                  <label key={o} className={option}><input type="radio" name={f.id} checked={v === o} disabled={disabled} onChange={() => onChange(f.id, o)} className="accent-violet-500" />{o}</label>
                ))}
              </fieldset>
            );
          case "multi":
            return (
              <fieldset key={f.id} className="flex flex-col gap-2"><legend className={cn(legend, "mb-1")}>{label}</legend>
                {f.options.map((o) => (
                  <label key={o} className={option}><input type="checkbox" checked={v.split(MULTI_SEP).includes(o)} disabled={disabled} onChange={() => onChange(f.id, toggleMulti(v, o))} className="accent-violet-500" />{o}</label>
                ))}
              </fieldset>
            );
          case "scale":
            return (
              <fieldset key={f.id} className="flex flex-col gap-2"><legend className={cn(legend, "mb-1")}>{label}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 11 }, (_, n) => (
                    <button
                      key={n} type="button" disabled={disabled} onClick={() => onChange(f.id, String(n))} aria-pressed={v === String(n)}
                      className={cn("grid h-9 w-9 place-items-center rounded-lg border text-sm tabular-nums transition",
                        v === String(n) ? "border-violet-500 bg-violet-600 text-white" : pub ? "border-white/10 text-white/80 hover:border-violet-400/60" : "border-border text-foreground hover:border-primary/60")}
                    >{n}</button>
                  ))}
                </div>
              </fieldset>
            );
          case "consent":
            return (
              <label key={f.id} className={cn("flex items-start gap-2.5 text-sm", pub ? "text-white/80" : "text-foreground")}>
                <input type="checkbox" checked={v === "Sim"} disabled={disabled} onChange={(e) => onChange(f.id, e.target.checked ? "Sim" : "")} className="mt-0.5 accent-violet-500" />
                <span>{label}</span>
              </label>
            );
          case "file":
            return (
              <div key={f.id} className="flex flex-col gap-1.5"><span className={legend}>{label}</span>
                <input type="file" disabled className={cn(inputCls, "opacity-50")} />
                <span className={cn("text-xs", pub ? "text-white/40" : "text-muted-foreground")}>O envio de arquivos ainda não está ativo: combine com a equipe pelo WhatsApp.</span>
              </div>
            );
          default:
            return (
              <label key={f.id} className="flex flex-col gap-1.5"><span className={legend}>{label}</span>
                <input type={INPUT_TYPES[f.type] ?? "text"} value={v} disabled={disabled} onChange={(e) => onChange(f.id, e.target.value)} className={inputCls} />
              </label>
            );
        }
      })}
    </div>
  );
}
