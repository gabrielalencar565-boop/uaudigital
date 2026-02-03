import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import { useToggleMagic2Stage, useCreateAndToggleMagic2Stage } from "@/features/magic2/hooks/use-magic2";
import { useMagic2Dashboard } from "@/features/magic2/hooks/use-magic2-dashboard";
import { useSession } from "@/hooks/use-session";
import { MonthYearNav } from "@/features/magic2/components/MonthYearNav";
import { Magic2Checklist } from "@/features/magic2/components/Magic2Checklist";
import { Magic2Dashboard } from "@/features/magic2/components/Magic2Dashboard";
import { CountdownTo27Badge } from "@/features/magic2/components/CountdownTo27Badge";
import type { Magic2StageKey } from "@/features/magic2/magic2-stages";

function getCycleMonthYear(now: Date) {
  // Regra do ciclo: se passou do dia 27, o ciclo vigente é do próximo mês (inicia dia 28).
  if (now.getDate() <= 27) return { year: now.getFullYear(), month: now.getMonth() + 1 };
  const y = now.getFullYear();
  const m = now.getMonth() + 2; // próximo mês (1-12)
  return m <= 12 ? { year: y, month: m } : { year: y + 1, month: 1 };
}

export function Magic2Panel() {
  const { user } = useSession();
  const now = new Date();
  const initial = getCycleMonthYear(now);
  const [year, setYear] = useState<number>(initial.year);
  const [month, setMonth] = useState<number>(initial.month);
  const [tab, setTab] = useState<"checklist" | "dashboard">("checklist");
  const { query: q, dashboard, cycles } = useMagic2Dashboard(year, month);
  const toggle = useToggleMagic2Stage();
  const createAndToggle = useCreateAndToggleMagic2Stage();

  const onToggleCell = async (stageId: string, current: boolean) => {
    if (!user) return;
    const nextCompleted = !current;
    try {
      await toggle.mutateAsync({
        stageId,
        nextCompleted,
        userId: user.id,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao marcar etapa");
    }
  };

  // Handler para criar stage on-demand quando não existe
  const onCreateAndToggle = async (cycleId: string, stage: Magic2StageKey) => {
    if (!user) return;
    try {
      await createAndToggle.mutateAsync({
        cycleId,
        stage,
        completed: true,
        userId: user.id,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar etapa");
    }
  };
  const hasAny = cycles.length > 0;
  const due = useMemo(() => new Date(year, month - 1, 27), [month, year]);
  return <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Contagem regressiva</h3>
          <div className="mt-1">
            <CountdownTo27Badge due={due} />
          </div>
          
        </div>
        <div className="flex items-center gap-3">
          <MonthYearNav month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
        </div>
      </div>

      {!hasAny ? (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted/50 grid place-items-center">
              <Target className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Nenhum cliente ativo neste mês</CardTitle>
            <CardDescription>
              Vá até <strong>Admin → Clientes</strong> para cadastrar clientes e definir os meses de contrato.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList className="bg-card/40">
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="checklist" className="mt-4">
            <Magic2Checklist
              year={year}
              month={month}
              cycles={cycles}
              stages={q.data?.stages ?? []}
              isBusy={toggle.isPending || createAndToggle.isPending}
              onToggleStage={onToggleCell}
              onCreateStage={onCreateAndToggle}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-4">
            <Magic2Dashboard dashboard={dashboard} year={year} month={month} />
          </TabsContent>
        </Tabs>
      )}
    </div>;
}