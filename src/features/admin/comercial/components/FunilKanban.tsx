import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable, type DragEndEvent } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGES, STAGE_LABEL, fmtCurrency, type CrmStage } from "../crm-constants";
import type { CrmLead } from "../hooks/use-crm-leads";
import type { CrmTask } from "../hooks/use-crm-tasks";
import { formatPhonePretty, type CrmWhatsAppContact } from "../hooks/use-crm-whatsapp-contacts";

interface Props {
  leads: CrmLead[];
  tasks: CrmTask[];
  members: { user_id: string; display_name: string; avatar_url: string | null }[];
  contactsByKey?: Map<string, CrmWhatsAppContact>;
  contactsById?: Map<string, CrmWhatsAppContact>;
  onLeadStageChange: (lead: CrmLead, newStage: CrmStage) => void;
  onLeadClick: (lead: CrmLead) => void;
}

function resolveContact(
  lead: CrmLead,
  byKey?: Map<string, CrmWhatsAppContact>,
  byId?: Map<string, CrmWhatsAppContact>,
): CrmWhatsAppContact | undefined {
  if (lead.whatsapp_contact_id && byId?.get(lead.whatsapp_contact_id)) return byId.get(lead.whatsapp_contact_id);
  if (lead.phone_key && byKey?.get(lead.phone_key)) return byKey.get(lead.phone_key);
  return undefined;
}

function LeadCard({ lead, member, hasOverdue, onClick }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, data: lead });
  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition border-border/60 bg-card",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{lead.nome}</div>
          {lead.empresa && <div className="text-xs text-muted-foreground truncate">{lead.empresa}</div>}
        </div>
        {member ? (
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage src={member.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px]">{(member.display_name || "?")[0]}</AvatarFallback>
          </Avatar>
        ) : (
          <Avatar className="h-6 w-6 shrink-0 opacity-60"><AvatarFallback className="text-[10px]">?</AvatarFallback></Avatar>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {lead.valor_estimado != null && lead.valor_estimado > 0 && (
          <Badge variant="secondary" className="text-[10px] font-medium">{fmtCurrency(Number(lead.valor_estimado))}</Badge>
        )}
        {lead.origem && <Badge variant="outline" className="text-[10px] capitalize">{lead.origem}</Badge>}
        {hasOverdue && (
          <Badge className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" variant="outline">
            <AlertTriangle className="h-3 w-3 mr-1" /> atrasada
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {timeAgo(lead.stage_changed_at)}
        </span>
      </div>
    </Card>
  );
}

function Column({ stage, leads, members, tasks, onLeadClick }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });
  const total = leads.reduce((s: number, l: CrmLead) => s + (Number(l.valor_estimado) || 0), 0);
  return (
    <div className="flex flex-col w-[280px] shrink-0">
      <div className={cn("rounded-lg border px-3 py-2 mb-2 flex items-center justify-between", stage.bg)}>
        <div className={cn("text-xs font-semibold uppercase tracking-wide", stage.color)}>{stage.label}</div>
        <div className="text-[10px] text-muted-foreground">{leads.length} · {fmtCurrency(total)}</div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-lg p-1.5 min-h-[200px] transition-colors",
          isOver && "bg-muted/40 ring-2 ring-primary/40",
        )}
      >
        {leads.map((lead: CrmLead) => {
          const member = members.find((m: any) => m.user_id === lead.responsavel_id);
          const hasOverdue = tasks.some((t: CrmTask) =>
            t.lead_id === lead.id && t.status === "pendente" && t.due_at && new Date(t.due_at) < new Date(),
          );
          return (
            <LeadCard key={lead.id} lead={lead} member={member} hasOverdue={hasOverdue} onClick={() => onLeadClick(lead)} />
          );
        })}
        {leads.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">Sem leads</div>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h`;
  const m = Math.floor(diff / 60000);
  return `${Math.max(m, 0)}m`;
}

export function FunilKanban({ leads, tasks, members, onLeadStageChange, onLeadClick }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map: Record<string, CrmLead[]> = {};
    for (const s of STAGES) map[s.value] = [];
    for (const l of leads) (map[l.stage] ?? (map[l.stage] = [])).push(l);
    return map;
  }, [leads]);

  const activeLead = leads.find((l) => l.id === activeId) ?? null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={(e: DragEndEvent) => {
        setActiveId(null);
        if (!e.over) return;
        const lead = e.active.data.current as CrmLead | undefined;
        const newStage = e.over.id as CrmStage;
        if (lead && lead.stage !== newStage) onLeadStageChange(lead, newStage);
      }}
    >
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((s) => (
            <Column
              key={s.value}
              stage={s}
              leads={byStage[s.value] ?? []}
              members={members}
              tasks={tasks}
              onLeadClick={onLeadClick}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeLead && (
          <Card className="p-3 w-[260px] shadow-xl">
            <div className="text-sm font-semibold">{activeLead.nome}</div>
            <div className="text-xs text-muted-foreground">{STAGE_LABEL[activeLead.stage]}</div>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}
