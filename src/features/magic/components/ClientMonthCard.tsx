import { useMemo } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, CircleDot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MAGIC_STAGES, clamp } from "@/lib/uau";

function CircleClock({ progress, daysLeft }: { progress: number; daysLeft: number }) {
  const size = 84;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - progress);

  const tone = progress >= 0.8 ? "success" : daysLeft <= 1 ? "danger" : daysLeft <= 3 ? "warning" : "primary";
  const strokeColor =
    tone === "success"
      ? "hsl(var(--success))"
      : tone === "warning"
        ? "hsl(var(--warning))"
        : tone === "danger"
          ? "hsl(var(--danger))"
          : "hsl(var(--primary))";

  return (
    <div className="relative">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--border))" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={strokeColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dash}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-lg font-semibold tabular-nums">{Math.max(0, daysLeft)}</div>
          <div className="text-[10px] text-muted-foreground">dias</div>
        </div>
      </div>
    </div>
  );
}

export type ClientMonthCardStage = {
  stage: string;
  completed: boolean;
};

export function ClientMonthCard({
  client,
  due,
  stages,
}: {
  client: { id: string; name: string };
  due: Date;
  stages: ClientMonthCardStage[];
}) {
  const computed = useMemo(() => {
    const total = MAGIC_STAGES.length;
    const magicKeySet = new Set<string>(MAGIC_STAGES.map((s) => s.key));
    const done = stages.filter((s) => s.completed && magicKeySet.has(s.stage)).length;
    const progress = total ? done / total : 0;
    const daysLeft = differenceInCalendarDays(due, new Date());
    const status = daysLeft < 0 ? "atrasado" : progress >= 0.85 ? "finalizando" : progress >= 0.35 ? "andamento" : "inicio";
    return { total, done, progress, daysLeft, status };
  }, [stages, due]);

  const badge =
    computed.status === "finalizando"
      ? ({ text: "🟢 finalização", variant: "success" as const, Icon: CheckCircle2 })
      : computed.status === "andamento"
        ? ({ text: "🟡 andamento", variant: "warning" as const, Icon: CircleDot })
        : computed.status === "atrasado"
          ? ({ text: "🔴 em risco", variant: "destructive" as const, Icon: AlertTriangle })
          : ({ text: "🔴 início", variant: "destructive" as const, Icon: AlertTriangle });

  const percent = Math.round(clamp(computed.progress * 100, 0, 100));

  return (
    <Card className="overflow-hidden">
      <div className="uau-sheen">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{client.name}</CardTitle>
              <CardDescription>Magic Number: {format(due, "dd 'de' MMM", { locale: ptBR })}</CardDescription>
            </div>
            <Badge variant={badge.variant} className="gap-2">
              <badge.Icon className="h-3.5 w-3.5" />
              {badge.text}
            </Badge>
          </div>
        </CardHeader>
      </div>

      <CardContent className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Progresso</p>
            <p className="text-sm font-medium tabular-nums">{percent}%</p>
          </div>
          <Progress value={percent} className="mt-2" />
          <p className="mt-3 text-xs text-muted-foreground">
            {computed.done}/{computed.total} etapas concluídas
          </p>
        </div>

        <CircleClock progress={computed.progress} daysLeft={computed.daysLeft} />
      </CardContent>
    </Card>
  );
}
