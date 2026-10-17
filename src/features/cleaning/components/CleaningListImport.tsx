import { useMemo, useState } from "react";
import { ListChecks, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DAYS_PT, useCleaningCategories, useImportCleaningSchedule } from "../hooks/use-cleaning";
import { parseCleaningList, rowIsReady, type ParsedRow } from "../lib/parse-cleaning-list";

const EXAMPLE = `Segunda
João - Passar pano
Maria - Varrer 17h

Terça: Ana Beatriz - Lavar banheiro; Pedro - Esvaziar lixeiras

Quarta a sexta - Maria e João - Varrer até as 18h`;

const sel = "h-8 rounded-md border border-border bg-background px-2 text-xs";

/** "Montar escala por texto": cola a lista, o sistema monta, você confere e confirma. */
export function CleaningListImport({ members }: { members: Array<{ user_id: string; display_name: string }> }) {
  const categoriesQ = useCleaningCategories();
  const importer = useImportCleaningSchedule();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [replace, setReplace] = useState(false);

  const people = useMemo(() => members.map((m) => ({ id: m.user_id, name: m.display_name })), [members]);
  const categories = categoriesQ.data ?? [];

  const build = () => {
    if (!text.trim()) { toast.error("Cole a lista primeiro"); return; }
    setRows(parseCleaningList(text, people, categories.map((c) => ({ id: c.id, name: c.name }))));
  };
  const patch = (key: string, changes: Partial<ParsedRow>) => setRows((r) => r && r.map((x) => (x.key === key ? { ...x, ...changes } : x)));

  const ready = (rows ?? []).filter(rowIsReady);
  const attention = (rows ?? []).length - ready.length;
  const newCats = [...new Set(ready.filter((r) => r.isNewCategory).map((r) => r.categoryName.toLowerCase()))].length;

  const confirm = () => {
    importer.mutate(
      { replace, rows: ready.map((r) => ({ day: r.day as number, userId: r.memberId as string, categoryId: r.categoryId, categoryName: r.categoryName, time: r.time })) },
      {
        onSuccess: (r) => {
          const parts = [`${r.created} nova${r.created === 1 ? "" : "s"}`];
          if (r.updated) parts.push(`${r.updated} atualizada${r.updated === 1 ? "" : "s"}`);
          if (r.removed) parts.push(`${r.removed} removida${r.removed === 1 ? "" : "s"} da escala`);
          if (r.newCategories) parts.push(`${r.newCategories} categoria${r.newCategories === 1 ? "" : "s"} criada${r.newCategories === 1 ? "" : "s"}`);
          toast.success(`Escala atualizada: ${parts.join(", ")}.`);
          setRows(null);
          setText("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar a escala"),
      },
    );
  };

  return (
    <Card className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.1s" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Montar escala por texto</CardTitle>
        <CardDescription>Cole a lista do jeito que você escreve e o sistema monta a escala. Você confere antes de salvar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={EXAMPLE}
          aria-label="Lista da escala de limpeza"
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="brand" onClick={build} disabled={categoriesQ.isLoading}><ListChecks className="mr-1 h-4 w-4" /> Montar escala</Button>
          <Button size="sm" variant="ghost" onClick={() => setText(EXAMPLE)}>Usar exemplo</Button>
          {rows && <Button size="sm" variant="ghost" onClick={() => setRows(null)}>Limpar prévia</Button>}
          <p className="text-xs text-muted-foreground">Funciona com: dia (segunda, seg, "segunda a sexta", "todos os dias"), pessoa, tarefa e horário (18h, 17:30). Sem horário, vale 18:00.</p>
        </div>

        {rows && (
          rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não encontrei nada na lista. Escreva um dia (ex.: Segunda) e depois "pessoa - tarefa" em cada linha.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-500">{ready.length} pronta{ready.length === 1 ? "" : "s"}</span>
                {attention > 0 && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-500">{attention} para conferir (não entram até corrigir)</span>}
                {newCats > 0 && <span className="rounded-full bg-sky-500/10 px-2.5 py-1 font-medium text-sky-500">{newCats} categoria{newCats === 1 ? "" : "s"} nova{newCats === 1 ? "" : "s"}</span>}
              </div>

              <div className="max-h-[420px] space-y-1.5 overflow-y-auto rounded-lg border border-border/60 p-2">
                {rows.map((r) => {
                  const ok = rowIsReady(r);
                  return (
                    <div key={r.key} className={cn("flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm", ok ? "bg-card/40" : "bg-amber-500/5 ring-1 ring-amber-500/30")}>
                      <select className={sel} aria-label="Dia" value={r.day ?? ""} onChange={(e) => patch(r.key, { day: e.target.value === "" ? null : Number(e.target.value), problems: [] })}>
                        <option value="">Dia…</option>
                        {DAYS_PT.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                      <select className={sel} aria-label="Pessoa" value={r.memberId ?? ""} onChange={(e) => patch(r.key, { memberId: e.target.value || null, problems: [] })}>
                        <option value="">{r.memberText ? `? ${r.memberText}` : "Pessoa…"}</option>
                        {(r.memberCandidates.length ? people.filter((p) => r.memberCandidates.includes(p.id)) : people).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select
                        className={sel}
                        aria-label="Tarefa"
                        value={r.categoryId ?? "__new"}
                        onChange={(e) => e.target.value === "__new" ? patch(r.key, { categoryId: null, isNewCategory: true }) : patch(r.key, { categoryId: e.target.value, categoryName: categories.find((c) => c.id === e.target.value)?.name ?? r.categoryName, isNewCategory: false })}
                      >
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        <option value="__new">{r.categoryName ? `Nova: ${r.categoryName}` : "Tarefa…"}</option>
                      </select>
                      <input type="time" className={cn(sel, "w-24")} aria-label="Horário limite" value={r.time} onChange={(e) => patch(r.key, { time: e.target.value || r.time })} />
                      {!ok && <span className="text-xs text-amber-500">{r.problems[0] ?? "Complete os campos"}</span>}
                      <button type="button" aria-label="Tirar da lista" className="ml-auto rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setRows((all) => all && all.filter((x) => x.key !== r.key))}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="mt-0.5 accent-violet-500" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                <span>Substituir a escala atual: o que está na escala e não aparece nesta lista sai da escala (o histórico de limpezas já feitas fica guardado).</span>
              </label>

              <Button variant="brand" size="sm" onClick={confirm} disabled={ready.length === 0 || importer.isPending}>
                {importer.isPending ? "Salvando…" : `Adicionar ${ready.length} à escala`}
              </Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
