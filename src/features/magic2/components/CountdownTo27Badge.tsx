import { differenceInCalendarDays, parseISO } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function pluralDia(n: number) {
  return n === 1 ? "dia" : "dias";
}

type Variant = "success" | "warning" | "destructive";

// Quando o mês já chegou a 100%, o selo deixa de contar dias e mostra se foi dentro do prazo,
// comparando o dia da última etapa concluída com o dia limite (não o dia em que alguém fechou o ciclo).
function DoneBadge({ due, completedAt }: { due: Date; completedAt: string | Date }) {
  const done = typeof completedAt === "string" ? parseISO(completedAt) : completedAt;
  const diff = differenceInCalendarDays(done, due); // > 0 = depois do prazo
  const late = Math.max(0, diff);

  const variant: Variant = diff <= 0 ? "success" : late <= 2 ? "warning" : "destructive";
  const title = diff <= 0 ? "Concluído no prazo" : "Concluído com atraso";
  const detail =
    diff < 0
      ? `sobra${-diff === 1 ? "" : "ram"} ${-diff} ${pluralDia(-diff)}`
      : diff === 0
        ? "no último dia"
        : `${late} ${pluralDia(late)} depois do prazo`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={variant} size="lg" className={cn(
        "w-fit text-white",
        variant === "success" && "bg-success",
        variant === "warning" && "bg-warning",
        variant === "destructive" && "bg-destructive",
      )}>
        {title}
      </Badge>
      <span className="inline-flex items-center rounded-full bg-foreground/80 px-2.5 py-0.5 text-xs font-medium text-background">{detail}</span>
    </div>
  );
}

export function CountdownTo27Badge({ due, now, completedAt }: { due: Date; now?: Date; completedAt?: string | Date | null }) {
  if (completedAt) return <DoneBadge due={due} completedAt={completedAt} />;
  const ref = now ?? new Date();
  const daysLeft = differenceInCalendarDays(due, ref);

  // Regra pedida: verde quando ainda dá tempo, amarelo quando faltam poucos dias,
  // vermelho quando for no dia (e também quando já passou).
  const warningCutoffDays = 10;

  const variant: Variant =
    daysLeft > warningCutoffDays ? "success" : daysLeft > 0 ? "warning" : "destructive";

  const text =
    daysLeft > 1
      ? `Faltam ${daysLeft} ${pluralDia(daysLeft)}`
      : daysLeft === 1
        ? "Falta 1 dia"
        : daysLeft === 0
          ? "Hoje é o dia"
          : `Venceu há ${Math.abs(daysLeft)} ${pluralDia(Math.abs(daysLeft))}`;

  return (
    <Badge variant={variant} size="lg" className={cn(
      "w-fit text-white",
      variant === "success" && "bg-success",
      variant === "warning" && "bg-warning",
      variant === "destructive" && "bg-destructive",
    )}>
      {text}
    </Badge>
  );
}
