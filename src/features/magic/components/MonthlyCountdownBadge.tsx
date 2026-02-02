import { differenceInCalendarDays } from "date-fns";

import { Badge } from "@/components/ui/badge";

function pluralDia(n: number) {
  return n === 1 ? "dia" : "dias";
}

export function MonthlyCountdownBadge({ due, now }: { due: Date; now?: Date }) {
  const ref = now ?? new Date();
  const daysLeft = differenceInCalendarDays(due, ref);

  // Padrão: verde até ficar "perto" (10 dias), amarelo quando estiver bem perto (<=10),
  // vermelho quando estiver crítico ou vencido (<=3).
  const warningCutoffDays = 10;
  const dangerCutoffDays = 3;

  const variant =
    daysLeft > warningCutoffDays
      ? "success"
      : daysLeft > dangerCutoffDays
        ? "warning"
        : "destructive";

  const text =
    daysLeft > 1
      ? `Faltam ${daysLeft} ${pluralDia(daysLeft)}`
      : daysLeft === 1
        ? "Falta 1 dia"
        : daysLeft === 0
          ? "Último dia"
          : `Venceu há ${Math.abs(daysLeft)} ${pluralDia(Math.abs(daysLeft))}`;

  return (
    <Badge variant={variant} className="w-fit text-xs font-semibold">
      {text}
    </Badge>
  );
}
