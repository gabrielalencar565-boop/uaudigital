import { useState } from "react";
import { cn } from "@/lib/utils";
import { useComercial } from "../ComercialContext";
import { useUpdateClient } from "../hooks/use-comercial";
import { brl, ONBOARDING_STAGES } from "../lib/rules";
import { Empty, PageHead } from "../components/ui-bits";

export function Onboarding() {
  const { clients, clientTasks, leadOf, openClient } = useComercial();
  const update = useUpdateClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const openTasks = clientTasks.filter((t) => !t.done).length;

  return (
    <div className="space-y-3">
      <PageHead
        title="Onboarding"
        subtitle="Clientes ganhos passando por briefing, plano, acessos e produção."
        right={
          <>
            <span className="rounded-full bg-muted px-3 py-1 text-xs"><b className="tabular-nums">{clients.length}</b> clientes</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs"><b className="tabular-nums">{openTasks}</b> tarefas abertas</span>
          </>
        }
      />
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {ONBOARDING_STAGES.map((s) => {
          const L = clients.filter((c) => c.onboarding_stage === s.id);
          return (
            <section
              key={s.id}
              onDragOver={(e) => { e.preventDefault(); setOverStage(s.id); }}
              onDragLeave={() => setOverStage((cur) => (cur === s.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                const c = clients.find((x) => x.id === dragId);
                setOverStage(null); setDragId(null);
                if (c && c.onboarding_stage !== s.id) update.mutate({ id: c.id, patch: { onboarding_stage: s.id } });
              }}
              className={cn("flex w-[290px] shrink-0 flex-col gap-2 rounded-2xl border border-border/50 bg-muted/20 p-2.5 transition",
                s.id === "producao" && "border-emerald-500/30 bg-emerald-500/5", overStage === s.id && "border-primary/60 bg-primary/5")}
            >
              <div className="px-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{s.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">{L.length}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{brl(L.reduce((a, c) => a + c.value, 0))}/mês</div>
              </div>
              <div className="flex min-h-[80px] flex-col gap-2">
                {L.length === 0 ? <Empty>Arraste um card pra cá</Empty> : L.map((c) => {
                  const lead = leadOf(c.lead_id);
                  const tasks = clientTasks.filter((t) => t.client_id === c.id);
                  const done = tasks.filter((t) => t.done).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); setDragId(c.id); }}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                      onClick={() => openClient(c.id)}
                      className={cn("flex w-full flex-col gap-1.5 rounded-xl border border-border/50 bg-background p-3 text-left shadow-sm transition hover:border-primary/40", dragId === c.id && "opacity-40")}
                    >
                      <span className="truncate text-sm font-semibold">{lead?.company || lead?.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{lead?.name} · {brl(c.value)}/mês</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-muted"><i className="block h-full rounded-full bg-primary" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} /></span>
                      <span className="text-[11px] text-muted-foreground">{done} de {tasks.length} tarefas</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
