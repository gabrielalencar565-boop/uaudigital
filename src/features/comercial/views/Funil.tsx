import { useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useComercial } from "../ComercialContext";
import { brl, isStale, leadStatus, nextActivity, staleDays, type Lead, type Stage } from "../lib/rules";
import { DueBadge, Empty, OwnerAvatar, PageHead } from "../components/ui-bits";
import { filterLeads, LeadFilterBar, useLeadFilters } from "../components/LeadFilters";

function LeadCard({ lead, stage, dragging, onDragStart, onDragEnd }: { lead: Lead; stage: Stage; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const { acts, today, memberOf, openLead } = useComercial();
  const status = leadStatus(stage, lead.id, acts, today);
  const stale = isStale(lead, stage);
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", lead.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={() => openLead(lead.id)}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-xl border border-border/50 bg-background p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow",
        dragging && "opacity-40",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold">{lead.name}</span>
        <OwnerAvatar member={memberOf(lead.owner_id)} />
      </span>
      {lead.company && <span className="truncate text-xs text-muted-foreground">{lead.company}</span>}
      <span className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium tabular-nums">{lead.value ? `${brl(lead.value)}/mês` : <span className="text-muted-foreground">sem valor</span>}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{lead.source}</span>
      </span>
      {lead.tags.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {lead.tags.map((t) => <span key={t} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{t}</span>)}
        </span>
      )}
      <DueBadge status={status} next={nextActivity(lead.id, acts)} today={today} />
      {stage.type === "lost" && lead.loss_reason && <span className="text-[11px] text-muted-foreground">Motivo: {lead.loss_reason}</span>}
      {stale && <span className="text-[11px] text-muted-foreground">Parado há {staleDays(lead)} dias</span>}
    </button>
  );
}

export function Funil() {
  const { leads, stages, acts, team, today, goto, moveLead } = useComercial();
  const { f, set } = useLeadFilters();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const items = useMemo(() => filterLeads(leads, f, stages, acts, today), [leads, f, stages, acts, today]);
  const count = (k: "late" | "today" | "none") => items.filter((l) => leadStatus(stages.find((s) => s.id === l.stage_id), l.id, acts, today) === k).length;
  const sorted = [...stages].sort((a, b) => a.position - b.position);

  const drop = (stageId: string) => {
    const lead = leads.find((l) => l.id === dragId);
    setOverStage(null);
    setDragId(null);
    if (lead && lead.stage_id !== stageId) moveLead(lead, stageId);
  };

  return (
    <div className="space-y-3">
      <PageHead title="Funil comercial" right={<Button variant="outline" size="sm" className="gap-1.5" onClick={() => goto("cfg")}><Settings2 className="h-3.5 w-3.5" /> Editar etapas</Button>} />
      <LeadFilterBar f={f} set={set} leads={leads} team={team} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {([["late", "atrasados", "text-red-500 bg-red-500/10"], ["today", "pra hoje", "text-amber-500 bg-amber-500/10"], ["none", "sem próxima ação", "text-muted-foreground bg-muted"]] as const).map(([k, t, tone]) => (
          <button
            key={k}
            type="button"
            aria-pressed={f.due === k}
            onClick={() => set({ due: f.due === k ? "" : k })}
            className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition", tone, f.due === k && "ring-2 ring-primary/60")}
          >
            <b className="tabular-nums">{count(k)}</b> {t}
          </button>
        ))}
        <span className="text-muted-foreground">Arraste os cards entre as colunas</span>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {sorted.map((s) => {
          const L = items.filter((l) => l.stage_id === s.id);
          const total = L.reduce((a, l) => a + l.value, 0);
          return (
            <section
              key={s.id}
              onDragOver={(e) => { e.preventDefault(); setOverStage(s.id); }}
              onDragLeave={() => setOverStage((cur) => (cur === s.id ? null : cur))}
              onDrop={(e) => { e.preventDefault(); drop(s.id); }}
              className={cn(
                "flex w-[272px] shrink-0 flex-col gap-2 rounded-2xl border border-border/50 bg-muted/20 p-2.5 transition",
                s.type === "won" && "border-emerald-500/30 bg-emerald-500/5",
                s.type === "lost" && "border-red-500/20 bg-red-500/5",
                overStage === s.id && "border-primary/60 bg-primary/5",
              )}
            >
              <div className="px-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{s.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">{L.length}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{brl(total)}/mês{s.type === "open" ? ` · ${s.probability}%` : ""}</div>
              </div>
              <div className="flex min-h-[80px] flex-col gap-2">
                {L.length === 0 ? <Empty>Arraste um card pra cá</Empty> : L.map((l) => (
                  <LeadCard key={l.id} lead={l} stage={s} dragging={dragId === l.id} onDragStart={() => setDragId(l.id)} onDragEnd={() => { setDragId(null); setOverStage(null); }} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
