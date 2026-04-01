import { differenceInCalendarDays } from "date-fns";

import { Badge } from "@/components/ui/badge";

function pluralDia(n: number) {
  return n === 1 ? "dia" : "dias";
}

type Variant = "success" | "warning" | "destructive";

export function CountdownTo27Badge({ due, now }: { due: Date; now?: Date }) {
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
