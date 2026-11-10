import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Link2, CalendarPlus, CheckCircle2, Check } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { getStageBadgeFor } from "../lib/stage-badge";
import { usePeriodicStages } from "../hooks/use-periodic-stages";
import type { PmTask } from "../pm-types";

interface ExistingTask {
  id: string;
  due_date: string;
  title: string;
}

/** O que a agenda deve destacar: tarefas da mesma cliente, na mesma etapa (e mesmo tipo), que ainda estão abertas. */
export interface LinkSearch {
  clientId: string;
  stage: string;
  postType?: string;
  referenceDate: string;
  excludeId: string;
}

/** Um painel de agenda. Planejamento aprovado abre dois lado a lado (Vídeo e Design); o avanço comum abre um só. */
export interface LinkPane {
  key: string;
  stageLabel: string;
  search: LinkSearch;
  /** tarefa já existente que vem escolhida; sem ela, vem escolhida a data padrão */
  existingTask: ExistingTask | null;
  defaultDate: string;
}

export type LinkPick = { kind: "link"; taskId: string; date: string } | { kind: "date"; date: string };

interface Props {
  open: boolean;
  onClose: () => void;
  panes: LinkPane[];
  clientName?: string;
  clientsMap?: Record<string, string>;
  membersMap?: Record<string, { name: string; avatar?: string }>;
  /** escolha de cada painel, pela chave do painel */
  onConfirm: (picks: Record<string, LinkPick>) => void;
}

type AgendaRow = PmTask;

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Tira o "[Cliente] - " do começo para o título caber no quadradinho do dia. */
const shortTitle = (t: string) => t.replace(/^\[[^\]]*\]\s*-\s*/, "");

const dm = (d: string) => format(new Date(`${d.slice(0, 10)}T12:00:00`), "dd/MM");

function pickText(pick: LinkPick | null | undefined, rows: AgendaRow[], pane: LinkPane): string {
  if (!pick) return "Nada escolhido";
  if (pick.kind === "date") return `Criar nova em ${dm(pick.date)}`;
  const row = rows.find((r) => r.id === pick.taskId);
  const title = row?.title ?? (pane.existingTask?.id === pick.taskId ? pane.existingTask.title : "tarefa");
  return `Vincular a ${shortTitle(title)} · ${dm(pick.date)}`;
}

function AgendaPane({ pane, pick, onPick, multi, clientsMap, membersMap }: {
  pane: LinkPane;
  pick: LinkPick | null;
  onPick: (p: LinkPick) => void;
  multi: boolean;
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
}) {
  const { data: periodicStages = [] } = usePeriodicStages();
  const search = pane.search;
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date(`${(pane.existingTask?.due_date ?? search.referenceDate).slice(0, 10)}T12:00:00`)));

  // Se a tarefa existente muda (outra busca), a agenda vai para o mês dela
  const existingDue = pane.existingTask?.due_date;
  useEffect(() => {
    if (existingDue) setMonth(startOfMonth(new Date(`${existingDue.slice(0, 10)}T12:00:00`)));
  }, [existingDue]);

  const rangeStart = format(startOfMonth(month), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(month), "yyyy-MM-dd");

  // Toda a agenda do mês (qualquer etapa e cliente), como na Agenda normal; as candidatas ficam em destaque
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["link_agenda_tasks", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pm_tasks")
        .select("id,client_id,title,status_global,stage_current,due_date,due_time,assignee_id,watchers,parent_task_id,is_extra_demand,post_type,alteration_origin,origin_task_id,periodic_stage_key,posting_time")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .not("due_date", "is", null)
        .gte("due_date", rangeStart)
        .lte("due_date", rangeEnd)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as AgendaRow[];
    },
  });

  const isCandidate = (r: AgendaRow) =>
    r.client_id === search.clientId &&
    r.stage_current === search.stage &&
    r.id !== search.excludeId &&
    !r.is_extra_demand &&
    !r.periodic_stage_key &&
    r.status_global !== "concluido" &&
    r.status_global !== "pausado" &&
    (!search.postType || r.post_type === search.postType);

  const byDay = useMemo(() => {
    const m = new Map<string, AgendaRow[]>();
    for (const r of rows) {
      const k = (r.due_date ?? "").slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    for (const [k, list] of m) m.set(k, [...list.filter(isCandidate), ...list.filter((r) => !isCandidate(r))]);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search.clientId, search.stage, search.postType, search.excludeId]);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }) }),
    [month],
  );

  const candidateCount = rows.filter(isCandidate).length;

  return (
    <div className={cn("min-w-0 space-y-3", multi && "rounded-2xl border border-border/40 p-2", multi && pick && "border-primary/50")}>
      {multi && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-0.5 text-base font-semibold text-primary-foreground">
            {pick && <Check className="h-4 w-4" />}
            {pane.stageLabel}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {pick?.kind === "link" ? <Link2 className="h-4 w-4 text-primary" /> : pick ? <CalendarPlus className="h-4 w-4" /> : null}
            {pickText(pick, rows, pane)}
          </span>
        </div>
      )}
      {!multi && (
        <p className="text-base text-foreground/80">
          {candidateCount > 0
            ? "Escolha uma das tarefas em destaque para vincular, ou um dia livre para criar uma nova nessa data."
            : "Não há tarefa para vincular neste mês. Escolha um dia para criar uma nova."}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-lg font-bold capitalize">{format(month, "MMMM", { locale: ptBR })} <span className="font-semibold text-muted-foreground">{format(month, "yyyy")}</span></span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Mês anterior" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Próximo mês" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={cn("grid grid-cols-7 gap-0.5", isLoading && "opacity-60")}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-0.5 text-center text-[11px] text-muted-foreground">{w}</div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, month);
          const list = inMonth ? byDay.get(key) ?? [] : [];
          const datePicked = pick?.kind === "date" && pick.date === key;
          return (
            <div
              key={key}
              role="button"
              tabIndex={inMonth ? 0 : -1}
              onClick={() => inMonth && onPick({ kind: "date", date: key })}
              onKeyDown={(e) => { if (inMonth && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPick({ kind: "date", date: key }); } }}
              className={cn(
                "flex flex-col gap-1 rounded-xl border p-0.5 text-left transition",
                multi ? "min-h-[80px]" : "min-h-[90px]",
                inMonth ? "cursor-pointer border-border/50 hover:border-border" : "pointer-events-none border-transparent opacity-30",
                datePicked && "border-dashed border-primary bg-primary/10",
              )}
            >
              <span className="text-[11px] text-muted-foreground">{format(day, "d")}</span>
              {list.slice(0, 4).map((r) => {
                const cand = isCandidate(r);
                const chosen = pick?.kind === "link" && pick.taskId === r.id;
                const badge = getStageBadgeFor(r, [], periodicStages);
                const done = r.status_global === "concluido" || r.stage_current === "entrega";
                const person = [r.assignee_id, ...(r.watchers ?? [])].map((id) => (id ? membersMap[id] : undefined)).find(Boolean);
                const client = clientsMap[r.client_id] ?? "—";
                // Cartão da Agenda, com o texto na largura inteira: selo e bolinha em cima, a foto acima do nome, e o nome e o cliente sem quebrar
                const content = (
                  <>
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[9px] font-bold tracking-wide text-white", badge.bg)} style={badge.style}>{badge.abbr}</span>
                      {done
                        ? <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                        : cand
                          ? <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", chosen ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/20 text-primary")}><Link2 className="h-3 w-3" /></span>
                          : <span className="h-5 w-5 shrink-0 rounded-full border border-muted-foreground/25" />}
                    </div>
                    {person
                      ? <UserAvatar avatarUrl={person.avatar} name={person.name} className="mt-1.5 h-7 w-7 shrink-0 ring-2 ring-background" fallbackClassName="text-[8px] font-bold bg-primary/10 text-primary" />
                      : <span className="mt-1.5 block h-7 w-7 shrink-0 rounded-full bg-muted ring-2 ring-background" />}
                    <p className="mt-1 break-words text-xs font-semibold leading-4">{person ? person.name.split(" ")[0] : client}</p>
                    {person && <p className={cn("break-words text-[11px] leading-3", chosen ? "text-primary-foreground/85" : "text-muted-foreground/70")}>{client}</p>}
                  </>
                );
                return cand ? (
                  <button
                    key={r.id}
                    type="button"
                    title={r.title}
                    onClick={(e) => { e.stopPropagation(); onPick({ kind: "link", taskId: r.id, date: key }); }}
                    className={cn(
                      "w-full rounded-xl border-2 px-1.5 py-1.5 text-left transition-all hover:-translate-y-0.5",
                      chosen ? "border-primary bg-primary text-primary-foreground" : "border-primary/70 bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={r.id} title={r.title} className="w-full rounded-xl border border-border/30 bg-card/60 px-1.5 py-1.5 opacity-60">
                    {content}
                  </div>
                );
              })}
              {list.length > 4 && <span className="text-[10px] text-muted-foreground">+{list.length - 4}</span>}
            </div>
          );
        })}
      </div>

      {!multi && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {pick?.kind === "link" ? <Link2 className="h-4 w-4 text-primary" /> : pick ? <CalendarPlus className="h-4 w-4" /> : null}
          {pickText(pick, rows, pane)}
        </p>
      )}
    </div>
  );
}

export function LinkOrDateDialog({ open, onClose, panes, clientName, clientsMap = {}, membersMap = {}, onConfirm }: Props) {
  const [picks, setPicks] = useState<Record<string, LinkPick | null>>({});
  const multi = panes.length > 1;

  // Ao abrir, cada painel já vem com a tarefa existente escolhida (ou com a data padrão): basta confirmar ou trocar
  const signature = panes.map((p) => `${p.key}:${p.existingTask?.id ?? ""}:${p.defaultDate}`).join("|");
  useEffect(() => {
    if (!open) return;
    const next: Record<string, LinkPick | null> = {};
    for (const p of panes) {
      next[p.key] = p.existingTask?.due_date
        ? { kind: "link", taskId: p.existingTask.id, date: p.existingTask.due_date }
        : p.defaultDate ? { kind: "date", date: p.defaultDate } : null;
    }
    setPicks(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signature]);

  const allPicked = panes.length > 0 && panes.every((p) => !!picks[p.key]);
  const stageNames = panes.map((p) => p.stageLabel).filter(Boolean);
  const firstPick = panes[0] ? picks[panes[0].key] : null;

  const confirm = () => {
    if (!allPicked) return;
    const out: Record<string, LinkPick> = {};
    for (const p of panes) out[p.key] = picks[p.key] as LinkPick;
    onConfirm(out);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={cn("max-h-[92vh] overflow-y-auto rounded-2xl z-[130]", multi ? "max-w-[99vw] p-4" : "max-w-6xl")}>
        <div className="space-y-2 pr-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <DialogTitle className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-extrabold leading-tight">
            <Link2 className="h-6 w-6 text-primary" />
            <span>{multi ? "Vincular tarefas" : "Vincular tarefa"}</span>
            {!multi && stageNames.map((n) => (
              <span key={n} className="rounded-full bg-primary px-3 py-0.5 text-base font-semibold text-primary-foreground">{n}</span>
            ))}
            {clientName && <span className="text-primary">{clientName}</span>}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={onClose}>Cancelar</Button>
            <Button type="button" className="rounded-xl" disabled={!allPicked} onClick={confirm}>
              {multi ? "Concluir" : firstPick?.kind === "link" ? "Vincular" : "Confirmar"}
            </Button>
          </div>
          </div>
          {multi && (
            <p className="text-base text-foreground/80">
              Em cada agenda, escolha uma tarefa em destaque para vincular, ou um dia livre para criar uma nova. Dá para concluir quando as duas estiverem escolhidas.
            </p>
          )}
        </div>

        <div className={cn("grid", multi ? "grid-cols-2 gap-3" : "grid-cols-1 gap-4")}>
          {panes.map((p) => (
            <AgendaPane
              key={p.key}
              pane={p}
              pick={picks[p.key] ?? null}
              onPick={(v) => setPicks((prev) => ({ ...prev, [p.key]: v }))}
              multi={multi}
              clientsMap={clientsMap}
              membersMap={membersMap}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-primary/70 bg-primary/15" />Pode vincular</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-border/40 bg-muted/30" />Outras tarefas</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
