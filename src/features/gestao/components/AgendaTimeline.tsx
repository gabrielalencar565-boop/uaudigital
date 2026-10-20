import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Plus } from "lucide-react";

import { UserAvatar } from "@/components/avatar/UserAvatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PmTask } from "@/features/gestao/pm-types";

// Visão por horário das abas Semana e Dia: cada dia é uma linha do tempo comprimida. Só aparecem as horas que têm
// tarefa (sem espaços vazios), em ordem; as tarefas sem horário continuam logo depois, no mesmo fluxo, ocupando a
// largura toda. Clicar na hora (ou no "+") define ou tira o horário; soltar um cartão em outro dia muda a data e
// mantém o horário que ele já tinha.

const timeRe = /^\d{2}:\d{2}$/;

export interface AgendaTimelineProps {
  days: Date[];
  tasksByDay: Map<string, PmTask[]>;
  todayKey: string;
  /** nome mostrado no cartão: o cliente, ou o título que a pessoa escreveu nas tarefas periódicas (reuniões etc.) */
  nameOf: (t: PmTask) => string;
  /** selo da etapa (sigla, cor e estilo), igual ao dos cartões do Mês */
  badgeOf: (t: PmTask) => { abbr: string; bg: string; style?: React.CSSProperties };
  onTaskClick: (t: PmTask) => void;
  /** time = "HH:MM" para marcar o horário, null para tirar */
  onSetTime: (taskId: string, dateKey: string, time: string | null) => void;
  /** responsável principal da tarefa, mostrado no cartão */
  personOf: (t: PmTask) => { id: string; name: string; avatar?: string } | null;
  className?: string;
}

export function TimeButton({ time, legacy, onSave }: { time: string | null; legacy: boolean; onSave: (time: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(time ?? "");
  if (legacy) return <span className="text-[11px] font-semibold tabular-nums text-primary">{time ?? ""}</span>;
  const save = (v: string | null) => {
    onSave(v);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(time ?? ""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded px-1 text-[11px] font-semibold tabular-nums transition",
            time ? "text-primary hover:bg-primary/10" : "text-muted-foreground/40 opacity-0 hover:bg-muted hover:text-foreground focus:opacity-100 group-hover/row:opacity-100",
          )}
          title={time ? "Alterar horário" : "Definir horário"}
        >
          {time ?? <Plus className="inline h-3 w-3" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 space-y-2 p-3" align="start">
        <p className="text-xs font-medium">Horário da tarefa</p>
        <input
          type="time"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && timeRe.test(value)) save(value); }}
          autoFocus
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        />
        <div className="flex gap-2">
          <Button size="sm" className="h-7 flex-1 text-xs" disabled={!timeRe.test(value)} onClick={() => save(value)}>Salvar</Button>
          {time && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => save(null)}>Remover</Button>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AgendaTimeline({ days, tasksByDay, todayKey, nameOf, badgeOf, onTaskClick, onSetTime, personOf, className }: AgendaTimelineProps) {
  const single = days.length === 1;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowHHMM = format(now, "HH:mm");

  const findTask = (id: string) => {
    for (const list of tasksByDay.values()) {
      const t = list.find((x) => x.id === id);
      if (t) return t;
    }
    return null;
  };

  return (
    <div className={cn(single ? "mx-auto grid max-w-2xl grid-cols-1" : "flex gap-3 overflow-x-auto pb-2", className)}>
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const isToday = key === todayKey;
        const all = tasksByDay.get(key) ?? [];
        const timed = all.filter((t) => t.due_time).sort((a, b) => a.due_time!.localeCompare(b.due_time!));
        const untimed = all.filter((t) => !t.due_time);
        const done = all.filter((t) => t.status_global === "concluido").length;
        // o marcador "agora" entra antes da primeira tarefa que ainda vai acontecer
        const nowIdx = isToday ? timed.findIndex((t) => t.due_time!.slice(0, 5) > nowHHMM) : -2;

        const row = (t: PmTask, hasTime: boolean) => {
          const isDone = t.status_global === "concluido";
          const legacy = t.id.startsWith("legacy_");
          const person = personOf(t);
          const card = (
            <button
              type="button"
              draggable={!legacy}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
              onClick={() => onTaskClick(t)}
              className={cn("block w-full rounded-lg border border-border/30 bg-card/60 px-2 py-1.5 text-left transition hover:bg-card", isDone && "opacity-55")}
              title={nameOf(t)}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn("inline-flex h-4 shrink-0 items-center rounded px-1 text-[9px] font-bold text-white", badgeOf(t).bg)} style={badgeOf(t).style}>{badgeOf(t).abbr}</span>
                <span className={cn("min-w-0 flex-1 truncate text-xs font-medium", isDone && "line-through")}>{nameOf(t)}</span>
                {isDone && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />}
              </span>
              <span className="mt-1 flex items-center gap-1.5">
                {person ? (
                  <UserAvatar avatarUrl={person.avatar} name={person.name} className="h-4 w-4" fallbackClassName="text-[7px] font-bold bg-primary/10 text-primary" />
                ) : (
                  <span className="h-4 w-4 rounded-full bg-muted" />
                )}
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{person ? person.name.split(" ")[0] : "Sem responsável"}</span>
              </span>
            </button>
          );
          // Com horário: a hora fica à esquerda, ligada ao cartão pela linha. Sem horário: o cartão ocupa a largura toda
          // (sem espaço reservado) e o "+" para definir a hora aparece ao passar o mouse, no canto.
          return hasTime ? (
            <li key={t.id} className="group/row flex gap-1.5">
              <div className="flex w-[42px] shrink-0 items-start justify-end pt-1.5">
                <TimeButton time={t.due_time!.slice(0, 5)} legacy={legacy} onSave={(v) => onSetTime(t.id, key, v)} />
              </div>
              <div className="min-w-0 flex-1 border-l-2 border-primary/70 pb-1 pl-1.5">{card}</div>
            </li>
          ) : (
            <li key={t.id} className="group/row relative pb-1">
              {card}
              {!legacy && (
                <span className="absolute right-1 top-1">
                  <TimeButton time={null} legacy={false} onSave={(v) => onSetTime(t.id, key, v)} />
                </span>
              )}
            </li>
          );
        };

        const nowMarker = (
          <li key="now" className="flex items-center gap-1.5 py-0.5" aria-label="Agora">
            <span className="w-[42px] shrink-0 pr-1 text-right text-[10px] font-medium text-destructive">agora</span>
            <span className="h-px flex-1 bg-destructive" />
          </li>
        );

        return (
          <section
            key={key}
            data-day-key={key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (!id || id.startsWith("legacy_")) return;
              const t = findTask(id);
              onSetTime(id, key, t?.due_time ? t.due_time.slice(0, 5) : null);
            }}
            className={cn("min-w-0 rounded-2xl border bg-card/20 p-2.5", !single && "min-w-[210px] flex-1", isToday ? "border-primary/60 ring-1 ring-primary/20" : "border-border/40")}
          >
            <header className="mb-2 flex items-baseline gap-2 px-1">
              <span className={cn("text-2xl font-semibold leading-none", isToday && "text-primary")}>{format(d, "d")}</span>
              <span className={cn("text-xs font-medium capitalize", isToday ? "text-primary" : "text-muted-foreground")}>
                {format(d, single ? "EEEE, d 'de' MMMM" : "EEE", { locale: ptBR }).replace(".", "")}
              </span>
              {all.length > 0 && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  {done === all.length && <CheckCircle2 className="h-3 w-3 text-success" />}
                  {done}/{all.length}
                </span>
              )}
            </header>
            {all.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground/60">Sem tarefas</p>
            ) : (
              <ul className={cn(single ? "" : "max-h-[640px] overflow-y-auto pr-0.5")}>
                {timed.map((t, i) => (
                  <span key={t.id} className="contents">
                    {nowIdx === i && nowMarker}
                    {row(t, true)}
                  </span>
                ))}
                {nowIdx === -1 && timed.length > 0 && nowMarker}
                {untimed.map((t) => row(t, false))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
