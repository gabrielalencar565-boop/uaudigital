import * as React from "react";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { StageKey } from "@/lib/uau";
import type { TaskStatus } from "@/features/data/queries";
import { MeuPainelTaskCard } from "@/features/meu-painel/components/MeuPainelTaskCard";

export type MeuPainelTaskVM = {
  id: string;
  clientName: string;
  stageLabel: string;
  stage: StageKey;
  title?: string | null;
  dueDate: string;
  status: TaskStatus;
  completedAt?: string | null;
};

type GroupHeaderProps = {
  title: string;
  count: number;
  open: boolean;
} & React.ComponentPropsWithoutRef<"div">;

const GroupHeader = React.forwardRef<HTMLDivElement, GroupHeaderProps>(
  ({ title, count, open, className, ...props }, ref) => (
    <div ref={ref} className={cn("flex w-full items-center justify-between gap-3", className)} {...props}>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground tabular-nums">({count})</span>
      </div>
      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
    </div>
  ),
);
GroupHeader.displayName = "GroupHeader";

export function MeuPainelTasksGroupedCard({
  overdue,
  today,
  upcoming,
  completed,
  isUpdating,
  onStart,
  onToggleComplete,
}: {
  overdue: MeuPainelTaskVM[];
  today: MeuPainelTaskVM[];
  upcoming: MeuPainelTaskVM[];
  completed: MeuPainelTaskVM[];
  isUpdating: boolean;
  onStart: (taskId: string) => void | Promise<void>;
  onToggleComplete: (taskId: string, current: TaskStatus) => void | Promise<void>;
}) {
  const [openOverdue, setOpenOverdue] = useState(true);
  const [openToday, setOpenToday] = useState(true);
  const [openUpcoming, setOpenUpcoming] = useState(true);
  const [openCompleted, setOpenCompleted] = useState(false);

  const totals = useMemo(
    () => ({ overdue: overdue.length, today: today.length, upcoming: upcoming.length, completed: completed.length }),
    [overdue.length, today.length, upcoming.length, completed.length],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atribuídas a mim</CardTitle>
        <CardDescription>Tarefas da agenda e limpeza organizadas por status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Collapsible open={openOverdue} onOpenChange={setOpenOverdue}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center rounded-lg border border-border/60 bg-card/20 px-3 py-2 text-left transition hover:bg-accent"
              >
                <GroupHeader title="Em atraso" count={totals.overdue} open={openOverdue} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 pl-2">
              {overdue.length ? (
                <div className="space-y-2">
                  {overdue.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "ml-2 w-[calc(100%-0.5rem)]",
                        "rounded-lg border border-border/60 bg-card/20 p-3",
                      )}
                    >
                      <MeuPainelTaskCard
                        clientName={t.clientName}
                        stageLabel={t.stageLabel}
                        stage={t.stage}
                        title={t.title}
                        dueDate={t.dueDate}
                        status={t.status}
                        completedAt={t.completedAt ?? null}
                        onToggleComplete={() => onToggleComplete(t.id, t.status)}
                        isUpdating={isUpdating}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa em atraso. Boa!</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={openToday} onOpenChange={setOpenToday}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center rounded-lg border border-border/60 bg-card/20 px-3 py-2 text-left transition hover:bg-accent"
              >
                <GroupHeader title="Hoje" count={totals.today} open={openToday} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 pl-2">
              {today.length ? (
                <div className="space-y-2">
                  {today.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "ml-2 w-[calc(100%-0.5rem)]",
                        "rounded-lg border border-border/60 bg-card/20 p-3",
                      )}
                    >
                      <MeuPainelTaskCard
                        clientName={t.clientName}
                        stageLabel={t.stageLabel}
                        stage={t.stage}
                        title={t.title}
                        dueDate={t.dueDate}
                        status={t.status}
                        completedAt={t.completedAt ?? null}
                        onToggleComplete={() => onToggleComplete(t.id, t.status)}
                        isUpdating={isUpdating}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa para hoje.</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={openUpcoming} onOpenChange={setOpenUpcoming}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center rounded-lg border border-border/60 bg-card/20 px-3 py-2 text-left transition hover:bg-accent"
              >
                <GroupHeader title="Próximas" count={totals.upcoming} open={openUpcoming} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 pl-2">
              {upcoming.length ? (
                <div className="space-y-2">
                  {upcoming.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "ml-2 w-[calc(100%-0.5rem)]",
                        "rounded-lg border border-border/60 bg-card/20 p-3",
                      )}
                    >
                      <MeuPainelTaskCard
                        clientName={t.clientName}
                        stageLabel={t.stageLabel}
                        stage={t.stage}
                        title={t.title}
                        dueDate={t.dueDate}
                        status={t.status}
                        completedAt={t.completedAt ?? null}
                        onToggleComplete={() => onToggleComplete(t.id, t.status)}
                        isUpdating={isUpdating}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa próxima.</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={openCompleted} onOpenChange={setOpenCompleted}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center rounded-lg border border-border/60 bg-card/20 px-3 py-2 text-left transition hover:bg-accent"
              >
                <GroupHeader title="Concluídas" count={totals.completed} open={openCompleted} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 pl-2">
              {completed.length ? (
                <div className="space-y-2">
                  {completed.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "ml-2 w-[calc(100%-0.5rem)]",
                        "rounded-lg border border-border/60 bg-card/20 p-3",
                      )}
                    >
                      <MeuPainelTaskCard
                        clientName={t.clientName}
                        stageLabel={t.stageLabel}
                        stage={t.stage}
                        title={t.title}
                        dueDate={t.dueDate}
                        status={t.status}
                        completedAt={t.completedAt ?? null}
                        onToggleComplete={() => onToggleComplete(t.id, t.status)}
                        isUpdating={isUpdating}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa concluída no mês.</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}
