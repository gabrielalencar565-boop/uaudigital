import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_TYPES, TASK_TYPE_LABEL, fmtDateTime } from "../crm-constants";
import { useCrmTasks } from "../hooks/use-crm-tasks";
import { useCrmLeads } from "../hooks/use-crm-leads";

export function ComercialTasksTab({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const { data: tasks = [] } = useCrmTasks();
  const { data: leads = [] } = useCrmLeads();

  const grouped = useMemo(() => {
    const overdue = tasks.filter((t) => t.status === "pendente" && t.due_at && new Date(t.due_at) < new Date());
    const today: typeof tasks = [];
    const upcoming: typeof tasks = [];
    const done: typeof tasks = [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    for (const t of tasks) {
      if (t.status === "concluida") { done.push(t); continue; }
      if (t.due_at && new Date(t.due_at) < new Date()) continue;
      if (t.due_at && new Date(t.due_at) >= start && new Date(t.due_at) < end) today.push(t);
      else upcoming.push(t);
    }
    return { overdue, today, upcoming, done };
  }, [tasks]);

  const leadMap = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);

  return (
    <div className="space-y-6">
      <Section title="Atrasadas" tasks={grouped.overdue} leadMap={leadMap} onOpenLead={onOpenLead} highlight />
      <Section title="Hoje" tasks={grouped.today} leadMap={leadMap} onOpenLead={onOpenLead} />
      <Section title="Próximas" tasks={grouped.upcoming} leadMap={leadMap} onOpenLead={onOpenLead} />
      <Section title="Concluídas" tasks={grouped.done.slice(0, 20)} leadMap={leadMap} onOpenLead={onOpenLead} muted />
    </div>
  );
}

function Section({ title, tasks, leadMap, onOpenLead, highlight, muted }: any) {
  if (tasks.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className={cn("text-sm font-semibold flex items-center gap-2", highlight && "text-rose-500")}>
        {highlight && <AlertTriangle className="h-4 w-4" />}
        {title} <Badge variant="outline" className="text-[10px]">{tasks.length}</Badge>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {tasks.map((t: any) => {
          const lead = leadMap[t.lead_id];
          return (
            <Card key={t.id} className={cn(
              "p-3 cursor-pointer hover:shadow-md transition",
              highlight && "border-rose-500/50 bg-rose-500/5",
              muted && "opacity-60",
            )} onClick={() => onOpenLead(t.lead_id)}>
              <div className="text-sm font-medium">
                <span className="mr-1">{TASK_TYPES.find((x) => x.value === t.tipo)?.emoji}</span>
                {t.titulo}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-1">
                <span>{TASK_TYPE_LABEL[t.tipo]}</span>
                {t.due_at && <span>· {fmtDateTime(t.due_at)}</span>}
                {lead && <span>· {lead.nome}</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
