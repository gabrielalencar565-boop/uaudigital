// Regras do CRM comercial (CRM-HANDOFF, seção 5), em funções puras para poder testar.
// Datas de atividade são "AAAA-MM-DD" no horário de Brasília; instantes (stage_changed_at, closed_at…) são ISO.

export type StageType = "open" | "won" | "lost";

export interface Stage {
  id: string;
  name: string;
  type: StageType;
  probability: number;
  position: number;
}

export interface Lead {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  segment: string | null;
  city: string | null;
  size: string | null;
  site: string | null;
  phone: string | null;
  phone_key: string | null;
  email: string | null;
  instagram: string | null;
  source: string;
  services: string[];
  tags: string[];
  owner_id: string | null;
  value: number;
  setup: number;
  close_by: string | null;
  stage_id: string;
  stage_changed_at: string;
  closed_at: string | null;
  loss_reason: string | null;
  whatsapp_contact_id: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  owner_id: string | null;
  type: string;
  title: string;
  due_date: string;
  done: boolean;
  done_at: string | null;
}

export interface ClientTask {
  id: string;
  client_id: string;
  title: string;
  owner_id: string | null;
  done: boolean;
  position: number;
}

export interface ComercialClient {
  id: string;
  lead_id: string;
  onboarding_stage: "briefing" | "plano" | "acessos" | "producao";
  value: number;
  setup: number;
  months: number;
  start_date: string;
  videos: number;
  artes: number;
  approver: string | null;
  services: string[];
  squad: { atendimento_id?: string; social_media_id?: string; trafego_id?: string };
}

export const SOURCES = ["WhatsApp", "Instagram", "Indicação", "Prospecção ativa", "Formulário"] as const;
export const SERVICES = ["Posicionamento", "Conteúdo", "Tráfego pago"] as const;
export const SIZES = ["MEI / autônomo", "Pequena", "Média"] as const;
export const LOSS_REASONS = ["Preço", "Fechou com concorrente", "Não é o momento", "Parou de responder", "Fora do perfil"] as const;
export const ACTIVITY_TYPES = ["Follow-up", "Ligação", "Reunião", "Primeira abordagem", "Enviar proposta", "Tarefa"] as const;
export const NOTE_KINDS = ["WhatsApp", "Reunião", "Ligação", "Instagram", "E-mail", "Anotação"] as const;
export const ONBOARDING_STAGES = [
  { id: "briefing", name: "Briefing online" },
  { id: "plano", name: "Apresentação do plano" },
  { id: "acessos", name: "Coleta de acessos" },
  { id: "producao", name: "Em produção" },
] as const;

/** Anotações feitas por pessoas (contam como contato já feito). As do sistema e das automações não contam. */
export const CONTACT_NOTE_KINDS = ["WhatsApp", "Reunião", "Ligação", "Instagram", "E-mail"];

// ───────────── datas ─────────────

/** Hoje em Brasília, "AAAA-MM-DD" (o horário do servidor/navegador não decide a virada do dia). */
export function todayBR(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Dias entre `date` e `today` (negativo = passado). */
export function diffDays(date: string, today: string = todayBR()): number {
  const a = Date.parse(`${date.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T12:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

export function addDays(n: number, today: string = todayBR()): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "14/10" */
export function shortDate(date: string | null | undefined): string {
  if (!date) return "";
  const [, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}`;
}

export function brl(v: number | null | undefined): string {
  return "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR");
}

/** Link do WhatsApp: só dígitos, prefixo 55 se faltar. */
export function waLink(phone: string | null | undefined): string {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (!d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}`;
}

export function initials(name: string | null | undefined): string {
  return String(name ?? "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ───────────── regras do lead ─────────────

export type DueStatus = "late" | "today" | "future" | "none";

export const isOpenStage = (stage: Stage | undefined): boolean => stage?.type === "open";

export function openActivities(leadId: string, acts: Activity[]): Activity[] {
  return acts.filter((a) => a.lead_id === leadId && !a.done).sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function nextActivity(leadId: string, acts: Activity[]): Activity | undefined {
  return openActivities(leadId, acts)[0];
}

/** Status do lead aberto pela próxima atividade pendente. Lead fechado: null. */
export function leadStatus(stage: Stage | undefined, leadId: string, acts: Activity[], today: string = todayBR()): DueStatus | null {
  if (!isOpenStage(stage)) return null;
  const a = nextActivity(leadId, acts);
  if (!a) return "none";
  const d = diffDays(a.due_date, today);
  return d < 0 ? "late" : d === 0 ? "today" : "future";
}

/** Parado: aberto e na mesma etapa há 7 dias ou mais. */
export function isStale(lead: Lead, stage: Stage | undefined, now: Date = new Date()): boolean {
  if (!isOpenStage(stage)) return false;
  return now.getTime() - new Date(lead.stage_changed_at).getTime() >= 7 * 86_400_000;
}

export function staleDays(lead: Lead, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(lead.stage_changed_at).getTime()) / 86_400_000);
}

/** Sem primeiro contato: nas duas primeiras etapas abertas, sem contato registrado e sem atividade concluída. */
export function noFirstContact(lead: Lead, stages: Stage[], acts: Activity[], leadIdsWithContact: Set<string>): boolean {
  const open = stages.filter((s) => s.type === "open").sort((a, b) => a.position - b.position);
  const firsts = open.slice(0, 2).map((s) => s.id);
  if (!firsts.includes(lead.stage_id)) return false;
  if (leadIdsWithContact.has(lead.id)) return false;
  return !acts.some((a) => a.lead_id === lead.id && a.done);
}

// ───────────── números da visão geral ─────────────

export interface Overview {
  created: Lead[];
  won: Lead[];
  lost: Lead[];
  open: Lead[];
  pipeline: number;
  forecast: number;
  sold: number;
  conversion: number | null;
  cycleDays: number | null;
  meetingsDone: number;
  meetingsScheduled: number;
  ticket: number | null;
  mrr: number;
  lateActivities: number;
}

/** `period` em dias (7/30/90) ou 0 para todo o período. */
export function computeOverview(
  leads: Lead[], stages: Stage[], acts: Activity[], clients: ComercialClient[], period: number, today: string = todayBR(),
): Overview {
  const stageOf = (id: string) => stages.find((s) => s.id === id);
  const inPeriod = (iso: string | null | undefined) => !!iso && (period === 0 || -diffDays(iso, today) < period);
  const created = leads.filter((l) => inPeriod(l.created_at));
  const won = leads.filter((l) => stageOf(l.stage_id)?.type === "won" && inPeriod(l.closed_at));
  const lost = leads.filter((l) => stageOf(l.stage_id)?.type === "lost" && inPeriod(l.closed_at));
  const open = leads.filter((l) => stageOf(l.stage_id)?.type === "open");
  const pipeline = open.reduce((s, l) => s + (Number(l.value) || 0), 0);
  const forecast = open.reduce((s, l) => s + (Number(l.value) || 0) * (stageOf(l.stage_id)?.probability ?? 0) / 100, 0);
  const sold = won.reduce((s, l) => s + (Number(l.value) || 0), 0);
  const closedCount = won.length + lost.length;
  const conversion = closedCount ? Math.round((won.length / closedCount) * 100) : null;
  const cycleDays = won.length
    ? Math.round(won.reduce((s, l) => s + (diffDays(l.closed_at!, today) - diffDays(l.created_at, today)), 0) / won.length)
    : null;
  const meetings = acts.filter((a) => a.type === "Reunião");
  return {
    created, won, lost, open, pipeline, forecast, sold, conversion, cycleDays,
    meetingsDone: meetings.filter((a) => a.done && inPeriod(a.due_date) && diffDays(a.due_date, today) <= 0).length,
    meetingsScheduled: meetings.filter((a) => !a.done && diffDays(a.due_date, today) >= 0).length,
    ticket: won.length ? sold / won.length : null,
    mrr: clients.reduce((s, c) => s + (Number(c.value) || 0), 0),
    lateActivities: acts.filter((a) => !a.done && diffDays(a.due_date, today) < 0).length,
  };
}

// ───────────── "o que fazer agora" ─────────────

export type AttentionSeverity = "late" | "today" | "info";
/** "há 3 h", "ontem", "há 5 dias": quanto tempo faz desde uma data. */
export function agoPt(iso: string | null | undefined, now: Date = new Date()): string | undefined {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return undefined;
  const min = Math.max(0, Math.round((now.getTime() - t) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export interface AttentionItem {
  leadId: string;
  sub: string;
  /** quanto tempo faz que a pendência existe ("há 3 h"), quando dá para saber */
  ago?: string;
  action: "whats" | "open" | "task" | "onb";
  clientId?: string;
}
export interface AttentionGroup {
  key: "late" | "first" | "meet" | "today" | "none" | "stale" | "onb";
  severity: AttentionSeverity;
  title: string;
  items: AttentionItem[];
}

export function attentionGroups(
  leads: Lead[], stages: Stage[], acts: Activity[], clients: ComercialClient[], clientTasks: ClientTask[],
  leadIdsWithContact: Set<string>, today: string = todayBR(), now: Date = new Date(),
): AttentionGroup[] {
  const stageOf = (id: string) => stages.find((s) => s.id === id);
  const leadOf = (id: string) => leads.find((l) => l.id === id);
  const open = leads.filter((l) => stageOf(l.stage_id)?.type === "open");
  const pending = acts.filter((a) => !a.done);
  const groups: AttentionGroup[] = [
    {
      key: "late", severity: "late", title: "follow-ups e atividades atrasadas",
      items: pending.filter((a) => diffDays(a.due_date, today) < 0 && leadOf(a.lead_id))
        .map((a) => ({ leadId: a.lead_id, sub: `${a.type} · venceu ${shortDate(a.due_date)}`, action: "whats" as const })),
    },
    {
      key: "first", severity: "late", title: "leads sem primeiro contato",
      items: open.filter((l) => noFirstContact(l, stages, acts, leadIdsWithContact))
        .map((l) => ({ leadId: l.id, sub: `${stageOf(l.stage_id)?.name} · chegou ${shortDate(l.created_at)}`, ago: agoPt(l.created_at, now), action: "whats" as const })),
    },
    {
      key: "meet", severity: "today", title: "reuniões hoje",
      items: pending.filter((a) => a.type === "Reunião" && diffDays(a.due_date, today) === 0 && leadOf(a.lead_id))
        .map((a) => ({ leadId: a.lead_id, sub: a.title, action: "open" as const })),
    },
    {
      key: "today", severity: "today", title: "contatos programados pra hoje",
      items: pending.filter((a) => a.type !== "Reunião" && diffDays(a.due_date, today) === 0 && leadOf(a.lead_id))
        .map((a) => ({ leadId: a.lead_id, sub: a.title, action: "whats" as const })),
    },
    {
      key: "none", severity: "today", title: "negócios sem próxima ação",
      items: open.filter((l) => !nextActivity(l.id, acts)).map((l) => ({ leadId: l.id, sub: stageOf(l.stage_id)?.name ?? "", action: "task" as const })),
    },
    {
      key: "stale", severity: "info", title: "negócios parados há 7 dias ou mais",
      items: open.filter((l) => isStale(l, stageOf(l.stage_id), now))
        .map((l) => ({ leadId: l.id, sub: `${stageOf(l.stage_id)?.name} desde ${shortDate(l.stage_changed_at)}`, ago: agoPt(l.stage_changed_at, now), action: "open" as const })),
    },
    {
      key: "onb", severity: "info", title: "clientes com onboarding em andamento",
      items: clients.filter((c) => c.onboarding_stage !== "producao" && leadOf(c.lead_id))
        .map((c) => ({ leadId: c.lead_id, clientId: c.id, sub: `${clientTasks.filter((t) => t.client_id === c.id && !t.done).length} tarefas abertas`, action: "onb" as const })),
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** Quantos itens "urgentes" (sem contar os informativos) aparecem no contador da Visão geral. */
export function attentionCount(groups: AttentionGroup[]): number {
  return groups.reduce((s, g) => s + (g.severity === "info" ? 0 : g.items.length), 0);
}
