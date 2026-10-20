import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2 } from "lucide-react";

import { UserAvatar } from "@/components/avatar/UserAvatar";
import { cn } from "@/lib/utils";
import type { PmTask } from "@/features/gestao/pm-types";
import { TimeButton } from "./AgendaTimeline";

// Visão Dia: uma faixa por pessoa. Cada faixa mostra, em sequência de horário, o que aquela pessoa tem no dia; quem não tem
// horário vem depois, no mesmo fluxo. Clicar na hora define ou tira o horário; clicar no cartão abre a tarefa.

interface Person {
  id: string;
  name: string;
  avatar?: string;
}

export interface AgendaDayByPersonProps {
  day: Date;
  tasks: PmTask[];
  todayKey: string;
  /** nome mostrado no cartão: o cliente, ou o título que a pessoa escreveu nas tarefas periódicas (reuniões etc.) */
  nameOf: (t: PmTask) => string;
  /** responsável principal da tarefa (null = sem responsável) */
  personOf: (t: PmTask) => Person | null;
  /** selo da etapa (sigla, cor e estilo), igual ao dos cartões do Mês */
  badgeOf: (t: PmTask) => { abbr: string; bg: string; style?: React.CSSProperties };
  onTaskClick: (t: PmTask) => void;
  onSetTime: (taskId: string, dateKey: string, time: string | null) => void;
}

export function AgendaDayByPerson({ day, tasks, todayKey, nameOf, personOf, badgeOf, onTaskClick, onSetTime }: AgendaDayByPersonProps) {
  const key = format(day, "yyyy-MM-dd");
  const isToday = key === todayKey;
  const done = tasks.filter((t) => t.status_global === "concluido").length;

  const rows = useMemo(() => {
    const byPerson = new Map<string, { person: Person | null; tasks: PmTask[] }>();
    for (const t of tasks) {
      const p = personOf(t);
      const k = p?.id ?? "__none__";
      const row = byPerson.get(k) ?? { person: p, tasks: [] };
      row.tasks.push(t);
      byPerson.set(k, row);
    }
    const sortTasks = (list: PmTask[]) =>
      list.slice().sort((a, b) => {
        if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
        if (a.due_time || b.due_time) return a.due_time ? -1 : 1;
        return 0;
      });
    // quem tem mais tarefas primeiro; "sem responsável" por último
    return [...byPerson.values()]
      .map((r) => ({ ...r, tasks: sortTasks(r.tasks) }))
      .sort((a, b) => (a.person ? 0 : 1) - (b.person ? 0 : 1) || b.tasks.length - a.tasks.length);
  }, [tasks, personOf]);

  return (
    <section data-day-key={key} className="px-1 py-1">
      <header className="mb-2 flex items-baseline gap-2 px-1">
        <span className={cn("text-2xl font-semibold leading-none", isToday && "text-primary")}>{format(day, "d")}</span>
        <span className={cn("text-xs font-medium", isToday ? "text-primary" : "text-muted-foreground")}>{(() => { const l = format(day, "EEEE, d 'de' MMMM", { locale: ptBR }); return l.charAt(0).toUpperCase() + l.slice(1); })()}</span>
        {tasks.length > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            {done === tasks.length && <CheckCircle2 className="h-3 w-3 text-success" />}
            {done}/{tasks.length}
          </span>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground/60">Sem tarefas neste dia</p>
      ) : (
        <div>
          {rows.map(({ person, tasks: list }) => (
            <div key={person?.id ?? "__none__"} className="flex items-start gap-3 border-t border-border/30 py-2.5">
              <div className="flex w-24 shrink-0 items-center gap-2 pt-1">
                {person ? (
                  <UserAvatar avatarUrl={person.avatar} name={person.name} className="h-6 w-6" fallbackClassName="text-[9px] font-bold bg-primary/10 text-primary" />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-muted" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium leading-4">{person ? person.name.split(" ")[0] : "Sem responsável"}</p>
                  <p className="text-[10px] leading-3 text-muted-foreground">{list.length} {list.length === 1 ? "tarefa" : "tarefas"}</p>
                </div>
              </div>
              <ul className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-0.5">
                {list.map((t) => {
                  const isDone = t.status_global === "concluido";
                  const legacy = t.id.startsWith("legacy_");
                  const time = t.due_time ? t.due_time.slice(0, 5) : null;
                  return (
                    <li key={t.id} className={cn("group/row flex items-center gap-1.5 rounded-md px-1.5 py-1 transition hover:bg-muted/50", isDone && "opacity-55")}>
                      {time && <TimeButton time={time} legacy={legacy} onSave={(v) => onSetTime(t.id, key, v)} />}
                      <button type="button" onClick={() => onTaskClick(t)} className="flex min-w-0 items-center gap-1.5 text-left" title={nameOf(t)}>
                        <span className={cn("inline-flex h-4 shrink-0 items-center rounded px-1 text-[9px] font-bold text-white", badgeOf(t).bg)} style={badgeOf(t).style}>{badgeOf(t).abbr}</span>
                        <span className={cn("max-w-[170px] truncate text-xs", isDone && "line-through")}>{nameOf(t)}</span>
                      </button>
                      {/* sem horário: o "+" fica à direita, só aparece ao passar o mouse e não deixa espaço vazio à esquerda */}
                      {!time && !legacy && (
                        <span className="w-4 shrink-0">
                          <TimeButton time={null} legacy={false} onSave={(v) => onSetTime(t.id, key, v)} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
