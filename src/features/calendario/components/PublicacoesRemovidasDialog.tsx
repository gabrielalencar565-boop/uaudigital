import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CONTENT_TYPE_LABELS } from "../calendar-types";
import { useRemovedPublicationsForClient, useRestorePublications, type RemovedPublication } from "../hooks/use-calendar-data";

interface Group { key: string; at: string; by: string | null; items: RemovedPublication[] }

/** Junta o que a mesma pessoa removeu no mesmo momento (até 2 minutos entre uma e outra): é o que dá para restaurar de uma vez. */
function groupByRemoval(rows: RemovedPublication[]): Group[] {
  const groups: Group[] = [];
  for (const r of rows) {
    const at = r.deleted_at as string;
    const last = groups[groups.length - 1];
    const sameBatch = last && last.by === (r.removedByName ?? r.deleted_by ?? null)
      && Math.abs(parseISO(last.items[last.items.length - 1].deleted_at as string).getTime() - parseISO(at).getTime()) < 120_000;
    if (sameBatch) last.items.push(r);
    else groups.push({ key: `${at}-${r.id}`, at, by: r.removedByName ?? r.deleted_by ?? null, items: [r] });
  }
  return groups;
}

export function PublicacoesRemovidasDialog({ clientId, open, onOpenChange }: { clientId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const removedQ = useRemovedPublicationsForClient(clientId);
  const restore = useRestorePublications();
  const groups = useMemo(() => groupByRemoval(removedQ.data ?? []), [removedQ.data]);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const isOpen = (g: Group, i: number) => (openKeys.has(g.key) ? true : openKeys.has(`-${g.key}`) ? false : i === 0);
  const toggle = (g: Group, i: number) => setOpenKeys((prev) => {
    const n = new Set(prev);
    const now = isOpen(g, i);
    n.delete(g.key); n.delete(`-${g.key}`);
    n.add(now ? `-${g.key}` : g.key);
    return n;
  });

  const run = (items: RemovedPublication[], label: string) => {
    const restorable = items.filter((p) => !p.taskGone);
    if (restorable.length === 0) return;
    restore.mutate(restorable, {
      onSuccess: () => toast.success(`${label} de volta no Cronograma, no mesmo dia.`),
      onError: (e: any) => toast.error(e?.message ?? "Não foi possível restaurar"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Publicações removidas</DialogTitle>
          <DialogDescription>Restaure e elas voltam para o mesmo dia, com legenda, capa e horário como estavam.</DialogDescription>
        </DialogHeader>

        {removedQ.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma publicação removida deste cliente.</p>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {groups.map((g, gi) => {
              const expanded = isOpen(g, gi);
              const restorable = g.items.filter((p) => !p.taskGone);
              return (
                <div key={g.key} className="rounded-xl border border-border/60">
                  <div className="flex items-center gap-2 p-3">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => toggle(g, gi)} aria-expanded={expanded}>
                      {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{g.items.length} publicaç{g.items.length === 1 ? "ão" : "ões"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          removida{g.items.length === 1 ? "" : "s"} em {format(parseISO(g.at), "dd/MM 'às' HH:mm", { locale: ptBR })}{g.by ? ` por ${g.by}` : ""}
                        </span>
                      </span>
                    </button>
                    <Button size="sm" className="h-8 shrink-0 gap-1.5" disabled={restorable.length === 0 || restore.isPending} onClick={() => run(restorable, restorable.length === 1 ? "1 publicação" : `${restorable.length} publicações`)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurar {g.items.length > 1 ? "todas" : ""}
                    </Button>
                  </div>
                  {expanded && (
                    <div className="space-y-1 border-t border-border/40 p-2">
                      {g.items.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{p.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {CONTENT_TYPE_LABELS[p.content_type] ?? p.content_type}
                              {" · "}
                              {p.publish_date ? `${format(parseISO(p.publish_date), "dd/MM/yyyy")}${p.publish_time ? ` às ${p.publish_time.slice(0, 5)}` : ""}` : "sem data"}
                              {p.caption ? " · com legenda" : ""}
                              {p.instagram_scheduled ? " · agendada no Instagram" : ""}
                            </p>
                          </div>
                          {p.taskGone ? (
                            <span className={cn("shrink-0 text-xs text-muted-foreground")}>tarefa apagada</span>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 shrink-0 gap-1 text-xs" disabled={restore.isPending} onClick={() => run([p], "1 publicação")}>
                              <RotateCcw className="h-3 w-3" /> Restaurar
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
