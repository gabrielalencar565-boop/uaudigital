import { useEffect, useMemo, useState } from "react";
import { format, getDay } from "date-fns";
import { Check } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { useCleaningCategories, useCleaningCompletions, useCleaningSchedules, useToggleCleaningCompletion } from "@/features/cleaning/hooks/use-cleaning";

/** Seu turno de limpeza de hoje: uma linha fina no topo de "Minhas tarefas", com o check. Some quando não é a sua vez. */
export function CleaningTurnBanner() {
  const { user } = useSession();
  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");
  const schedulesQ = useCleaningSchedules();
  const categoriesQ = useCleaningCategories();
  const completionsQ = useCleaningCompletions(todayKey);
  const toggle = useToggleCleaningCompletion();
  // reavalia o atraso a cada minuto, sem precisar recarregar a tela
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const nowHm = format(now, "HH:mm");

  const mine = useMemo(
    () => (schedulesQ.data ?? []).filter((s) => s.day_of_week === getDay(today) && s.user_id === user?.id).sort((a, b) => (a.due_time ?? "").localeCompare(b.due_time ?? "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedulesQ.data, user?.id, todayKey],
  );
  const catById = useMemo(() => new Map((categoriesQ.data ?? []).map((c) => [c.id, c])), [categoriesQ.data]);
  const doneIds = useMemo(() => new Set((completionsQ.data ?? []).map((c) => c.schedule_id)), [completionsQ.data]);

  if (mine.length === 0) return null;

  return (
    <div className="mx-5 mb-4 mt-3 space-y-2">
      {mine.map((s) => {
        const done = doneIds.has(s.id);
        const cat = catById.get(s.category_id);
        const due = s.due_time?.slice(0, 5) ?? "18:00";
        const late = !done && nowHm > due;
        return (
          <button
            key={s.id}
            type="button"
            disabled={toggle.isPending}
            aria-pressed={done}
            title={done ? "Desmarcar limpeza" : "Marcar limpeza como feita"}
            onClick={() => user && toggle.mutate({ scheduleId: s.id, date: todayKey, userId: user.id, isCompleted: done })}
            className={cn(
              "group flex w-full items-center gap-2 rounded-full border py-1.5 pl-4 pr-2 text-left transition-colors",
              done && "border-emerald-500/30 bg-emerald-500/10",
              late && "border-red-500/40 bg-red-500/10 hover:bg-red-500/15",
              !done && !late && "border-primary/30 bg-primary/10 hover:bg-primary/15",
            )}
          >
            <span className={cn("min-w-0 flex-1 truncate text-[13px]", done && "text-muted-foreground line-through")}>
              {cat?.emoji ? `${cat.emoji} ` : ""}
              {cat?.name ?? "Limpeza"}
            </span>
            <span className={cn("shrink-0 text-[11px] tabular-nums", late ? "font-medium text-red-400" : "text-muted-foreground")}>
              {done ? "feita" : late ? `atrasada · ${due}` : `até ${due}`}
            </span>
            <span
              className={cn(
                "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                done && "border-emerald-500 bg-emerald-500 text-white",
                late && "border-red-400/70 text-transparent group-hover:text-red-400/70",
                !done && !late && "border-primary/60 text-transparent group-hover:text-primary/70",
              )}
            >
              <Check className="h-3 w-3" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
