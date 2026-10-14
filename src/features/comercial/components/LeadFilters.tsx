import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { leadStatus, SOURCES, type Activity, type DueStatus, type Lead, type Stage } from "../lib/rules";
import type { TeamMember } from "../hooks/use-comercial";

export interface LeadFilterState {
  q: string;
  owner: string;
  source: string;
  tag: string;
  stage: string;
  due: "" | DueStatus;
}

const EMPTY: LeadFilterState = { q: "", owner: "", source: "", tag: "", stage: "", due: "" };

export function useLeadFilters() {
  const [f, setF] = useState<LeadFilterState>(EMPTY);
  return { f, set: (patch: Partial<LeadFilterState>) => setF((prev) => ({ ...prev, ...patch })) };
}

export function filterLeads(leads: Lead[], f: LeadFilterState, stages: Stage[], acts: Activity[], today: string): Lead[] {
  const q = f.q.trim().toLowerCase();
  return leads.filter((l) => {
    if (q && ![l.name, l.company, l.phone, l.email, l.instagram, l.segment, l.city].join(" ").toLowerCase().includes(q)) return false;
    if (f.owner && l.owner_id !== f.owner) return false;
    if (f.source && l.source !== f.source) return false;
    if (f.stage && l.stage_id !== f.stage) return false;
    if (f.tag && !l.tags.includes(f.tag)) return false;
    if (f.due && leadStatus(stages.find((s) => s.id === l.stage_id), l.id, acts, today) !== f.due) return false;
    return true;
  });
}

const ALL = "__all__";

export function LeadFilterBar({
  f, set, leads, team, stages, withStage,
}: { f: LeadFilterState; set: (p: Partial<LeadFilterState>) => void; leads: Lead[]; team: TeamMember[]; stages?: Stage[]; withStage?: boolean }) {
  const tags = useMemo(() => [...new Set(leads.flatMap((l) => l.tags))].sort(), [leads]);
  const pick = (key: keyof LeadFilterState) => (v: string) => set({ [key]: v === ALL ? "" : v } as Partial<LeadFilterState>);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Buscar nome, empresa, telefone…" className="h-9 w-[240px] pl-8" />
      </div>
      <Select value={f.owner || ALL} onValueChange={pick("owner")}>
        <SelectTrigger className="h-9 w-[190px]" aria-label="Responsável"><SelectValue placeholder="Responsável" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
          {team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={f.source || ALL} onValueChange={pick("source")}>
        <SelectTrigger className="h-9 w-[170px]" aria-label="Origem"><SelectValue placeholder="Origem" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as origens</SelectItem>
          {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      {tags.length > 0 && (
        <Select value={f.tag || ALL} onValueChange={pick("tag")}>
          <SelectTrigger className="h-9 w-[170px]" aria-label="Etiqueta"><SelectValue placeholder="Etiqueta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as etiquetas</SelectItem>
            {tags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {withStage && stages && (
        <Select value={f.stage || ALL} onValueChange={pick("stage")}>
          <SelectTrigger className="h-9 w-[170px]" aria-label="Etapa"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as etapas</SelectItem>
            {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
