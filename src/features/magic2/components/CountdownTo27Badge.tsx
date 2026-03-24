import { differenceInCalendarDays } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function pluralDia(n: number) {
  return n === 1 ? "dia" : "dias";
}

const VARIANT_SOLID: Record<string, string> = {
  success: "bg-success text-white border-success",
  warning: "bg-warning text-white border-warning",
  destructive: "bg-destructive text-white border-destructive",
};

export function CountdownTo27Badge({ due, now }: { due: Date; now?: Date }) {
  const ref = now ?? new Date();
  const daysLeft = differenceInCalendarDays(due, ref);

  const warningCutoffDays = 10;

  const variant =
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
    <Badge variant={variant as any} size="lg" className={cn("w-fit", VARIANT_SOLID[variant])}>
      {text}
    </Badge>
  );
}
