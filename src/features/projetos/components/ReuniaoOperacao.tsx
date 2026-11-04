import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ChevronRight, Copy, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useClientsIncludingEnded, useTeamMembers } from "@/features/data/queries";
import { STAGES } from "@/lib/uau";
import { cn } from "@/lib/utils";

type PeriodKey = "mes" | "30d" | "90d" | "ano";
type BlockKey = "tarefas" | "prazos" | "remarcacoes" | "alteracoes" | "extras";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "mes", label: "Este mês" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "ano", label: "Ano" },
];

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PAGE = 1000;
const STALE = 5 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REMOVED = "Tarefa removida";

const spDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const dayNum = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86400000;
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);
const fmt = (n: number) => n.toLocaleString("pt-BR");

function addDays(ymd: string, n: number) {
  return new Date((dayNum(ymd) + n) * 86400000).toISOString().slice(0, 10);
}

function periodStart(key: PeriodKey, today: string) {
  if (key === "mes") return `${today.slice(0, 7)}-01`;
  if (key === "30d") return addDays(today, -29);
  if (key === "90d") return addDays(today, -89);
  return `${today.slice(0, 4)}-01-01`;
}

type PageResult = PromiseLike<{ data: unknown[] | null; error: unknown }>;

async function fetchAll<T>(page: (from: number, to: number) => PageResult): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

// ───────── dados ─────────

type Done = { due_date: string; stage: string; assigned_user_id: string | null; client_id: string | null; late: boolean; daysLate: number };

// Cada conclusão de etapa fica registrada em `tasks` com a data; "no prazo" = concluída até o dia do prazo (mesma regra do relatório de Desempenho).
function useDoneTasks(today: string) {
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return useQuery({
    queryKey: ["reuniao_prazos", yearStart, today],
    staleTime: STALE,
    queryFn: async (): Promise<Done[]> => {
      const rows = await fetchAll<{ due_date: string; completed_at: string; stage: string; assigned_user_id: string | null; client_id: string | null }>((from, to) =>
        supabase
          .from("tasks")
          .select("due_date, completed_at, stage, assigned_user_id, client_id")
          .is("deleted_at", null)
          .not("completed_at", "is", null)
          .gte("due_date", yearStart)
          .lte("due_date", today)
          .order("due_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      );
      return rows.map((r) => {
        const daysLate = Math.max(0, dayNum(spDate(new Date(r.completed_at))) - dayNum(r.due_date));
        return { due_date: r.due_date, stage: r.stage, assigned_user_id: r.assigned_user_id, client_id: r.client_id, late: daysLate > 0, daysLate };
      });
    },
  });
}

type Resched = { day: string; task_id: string; delta: number };

function useRescheduled(today: string) {
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return useQuery({
    queryKey: ["reuniao_remarcacoes", yearStart, today],
    staleTime: STALE,
    queryFn: async (): Promise<Resched[]> => {
      const rows = await fetchAll<{ task_id: string; old_value: string | null; new_value: string | null; created_at: string }>((from, to) =>
        (supabase.from("task_activity_log" as any) as any)
          .select("task_id, old_value, new_value, created_at")
          .eq("action", "date_changed")
          .gte("created_at", `${yearStart}T00:00:00-03:00`)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      );
      const out: Resched[] = [];
      for (const r of rows) {
        if (!r.old_value || !r.new_value || !DATE_RE.test(r.old_value) || !DATE_RE.test(r.new_value)) continue;
        out.push({ day: spDate(new Date(r.created_at)), task_id: r.task_id, delta: dayNum(r.new_value) - dayNum(r.old_value) });
      }
      return out;
    },
  });
}

type TaskOwner = { assignee: string | null; client: string | null };
const IDS_PER_REQUEST = 100;
const PARALLEL = 4;

// A remarcação vale para o dono da tarefa, não para quem trocou a data: busca responsável e cliente de cada tarefa remarcada.
function useTaskOwners(ids: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["reuniao_donos", ids.length, ids[0] ?? "", ids[ids.length - 1] ?? ""],
    enabled: enabled && ids.length > 0,
    staleTime: STALE,
    queryFn: async (): Promise<Record<string, TaskOwner>> => {
      const out: Record<string, TaskOwner> = {};
      const lookup = async (list: string[], load: (chunk: string[]) => PageResult, pick: (r: any) => TaskOwner) => {
        const chunks: string[][] = [];
        for (let i = 0; i < list.length; i += IDS_PER_REQUEST) chunks.push(list.slice(i, i + IDS_PER_REQUEST));
        for (let i = 0; i < chunks.length; i += PARALLEL) {
          await Promise.all(
            chunks.slice(i, i + PARALLEL).map(async (chunk) => {
              const { data, error } = await load(chunk);
              if (error) throw error;
              for (const r of (data ?? []) as any[]) out[r.id] = pick(r);
            })
          );
        }
      };
      await lookup(ids, (chunk) => supabase.from("pm_tasks").select("id, assignee_id, client_id").in("id", chunk), (r) => ({ assignee: r.assignee_id, client: r.client_id }));
      // Remarcações mais antigas apontam para a tabela de conclusões.
      const missing = ids.filter((id) => !out[id]);
      await lookup(missing, (chunk) => supabase.from("tasks").select("id, assigned_user_id, client_id").in("id", chunk), (r) => ({ assignee: r.assigned_user_id, client: r.client_id }));
      return out;
    },
  });
}

type Alteration = { day: string; client_id: string | null; assignee_id: string | null; origin: string; requested: boolean };

function useAlterations() {
  return useQuery({
    queryKey: ["reuniao_alteracoes"],
    staleTime: STALE,
    queryFn: async (): Promise<Alteration[]> => {
      const rows = await fetchAll<{ created_at: string; client_id: string | null; assignee_id: string | null; alteration_origin: string; alteration_requested_by: string | null }>((from, to) =>
        supabase
          .from("pm_tasks")
          .select("created_at, client_id, assignee_id, alteration_origin, alteration_requested_by")
          .is("deleted_at", null)
          .not("alteration_origin", "is", null)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      );
      return rows.map((r) => ({
        day: spDate(new Date(r.created_at)),
        client_id: r.client_id,
        assignee_id: r.assignee_id,
        origin: r.alteration_origin,
        requested: !!r.alteration_requested_by,
      }));
    },
  });
}

type MonthTask = { due_date: string; client_id: string | null; assignee_id: string | null; done: boolean; extra: boolean };

// Tarefas-raiz do pipeline (as subtarefas de PDF ficam de fora), com prazo no ano.
function useMonthTasks(today: string) {
  const year = today.slice(0, 4);
  return useQuery({
    queryKey: ["reuniao_tarefas", year],
    staleTime: STALE,
    queryFn: async (): Promise<MonthTask[]> => {
      const rows = await fetchAll<{ due_date: string; client_id: string | null; assignee_id: string | null; status_global: string; is_extra_demand: boolean | null }>((from, to) =>
        supabase
          .from("pm_tasks")
          .select("due_date, client_id, assignee_id, status_global, is_extra_demand")
          .is("deleted_at", null)
          .is("parent_task_id", null)
          .eq("is_draft", false)
          .gte("due_date", `${year}-01-01`)
          .lte("due_date", `${year}-12-31`)
          .order("due_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      );
      return rows.map((r) => ({ due_date: r.due_date, client_id: r.client_id, assignee_id: r.assignee_id, done: r.status_global === "concluido", extra: !!r.is_extra_demand }));
    },
  });
}

// ───────── peças visuais ─────────

function rateTone(rate: number) {
  if (rate >= 35) return { bar: "bg-red-500", text: "text-red-500" };
  if (rate >= 20) return { bar: "bg-amber-500", text: "text-amber-500" };
  return { bar: "bg-emerald-500", text: "text-emerald-500" };
}

/** Barra proporcional; `value` define o comprimento em relação a `max`. */
function BarRow({ label, value, max, right, barClass }: { label: string; value: number; max: number; right: string; barClass: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr_64px] items-center gap-2 text-xs sm:text-sm">
      <span className="truncate" title={label}>{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barClass)} style={{ width: `${max ? Math.max((value / max) * 100, 2) : 2}%` }} />
      </div>
      <span className="text-right text-xs text-muted-foreground tabular-nums">{right}</span>
    </div>
  );
}

function RateRow({ label, late, total }: { label: string; late: number; total: number }) {
  const rate = pct(late, total);
  return <BarRow label={label} value={rate} max={100} right={`${late}/${total}`} barClass={rateTone(rate).bar} />;
}

function CountRows({ items, barClass }: { items: { label: string; n: number }[]; barClass: string }) {
  const max = Math.max(...items.map((i) => i.n), 1);
  return (
    <div className="space-y-2">
      {items.map((i) => <BarRow key={i.label} label={i.label} value={i.n} max={max} right={fmt(i.n)} barClass={barClass} />)}
    </div>
  );
}

type Col = { label: string; value: number; color: string };

function MiniBars({ cols }: { cols: Col[] }) {
  const max = Math.max(...cols.map((c) => c.value), 1);
  return (
    <div className="flex h-12 items-end gap-1">
      {cols.map((c) => (
        <div key={c.label} className="flex h-full flex-1 flex-col justify-end" title={`${c.label}: ${fmt(c.value)}`}>
          <div className={cn("w-full rounded-t-sm", c.color)} style={{ height: `${Math.max((c.value / max) * 100, 4)}%` }} />
        </div>
      ))}
    </div>
  );
}

function MonthChart({ cols, unit }: { cols: Col[]; unit?: string }) {
  const max = Math.max(...cols.map((c) => c.value), 1);
  return (
    <div>
      <div className="flex h-28 items-end gap-2">
        {cols.map((c) => (
          <div key={c.label} className="flex h-full flex-1 flex-col justify-end" title={`${c.label}: ${fmt(c.value)}${unit ?? ""}`}>
            <div className={cn("w-full rounded-t", c.color)} style={{ height: `${Math.max((c.value / max) * 100, 4)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-center text-[11px] text-muted-foreground">
        {cols.map((c) => <span key={c.label} className="flex-1">{c.label}<br />{fmt(c.value)}{unit ?? ""}</span>)}
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className={cn("text-2xl font-semibold tabular-nums", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}{hint && <span className="font-normal text-muted-foreground"> {hint}</span>}</p>
      {children}
    </div>
  );
}

function BlockButton({ title, big, bigClass, sub, foot, wide, onClick, children }: { title: string; big: string; bigClass?: string; sub: string; foot?: string; wide?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("group rounded-xl border bg-muted/30 p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", wide && "sm:col-span-2")}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{title}</p>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", bigClass)}>
        {big} <span className="text-xs font-normal text-muted-foreground">{sub}</span>
      </p>
      {foot && <p className="text-xs text-muted-foreground">{foot}</p>}
      <div className="mt-3">{children}</div>
    </button>
  );
}

type Tone = "crit" | "warn" | "good";
const TONE_CLASS: Record<Tone, string> = {
  crit: "bg-red-500/10 text-red-600 dark:text-red-400",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};
const TONE_LABEL: Record<Tone, string> = { crit: "Crítico", warn: "Atenção", good: "Bom" };

function countBy<T>(rows: T[], keyOf: (r: T) => string) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(keyOf(r), (map.get(keyOf(r)) ?? 0) + 1);
  return [...map.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
}

function monthCols(days: string[], color: string): Col[] {
  const counts = Array(12).fill(0) as number[];
  for (const d of days) counts[+d.slice(5, 7) - 1] += 1;
  const first = counts.findIndex((n) => n > 0);
  const last = counts.length - 1 - [...counts].reverse().findIndex((n) => n > 0);
  if (first < 0) return [];
  return counts.slice(first, last + 1).map((value, i) => ({ label: MONTHS[first + i], value, color }));
}

// ───────── relatório do mês (texto pronto para colar em uma IA) ─────────

const MONTHS_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const monthLabel = (ym: string) => `${MONTHS_FULL[+ym.slice(5, 7) - 1]} de ${ym.slice(0, 4)}`;
const prevMonth = (ym: string) => (+ym.slice(5, 7) === 1 ? null : `${ym.slice(0, 4)}-${String(+ym.slice(5, 7) - 1).padStart(2, "0")}`);

type ReportInput = {
  ym: string;
  today: string;
  done: Done[];
  tasks: MonthTask[];
  resched: Resched[];
  alts: Alteration[];
  owners: Record<string, TaskOwner> | null;
  person: (id: string | null) => string;
  client: (id: string | null) => string;
  withPrompt: boolean;
};

function monthStats(ym: string, i: ReportInput) {
  const done = i.done.filter((r) => r.due_date.startsWith(ym));
  const tasks = i.tasks.filter((r) => r.due_date.startsWith(ym));
  const resched = i.resched.filter((r) => r.day.startsWith(ym));
  const alts = i.alts.filter((r) => r.day.startsWith(ym));
  const late = done.filter((r) => r.late).length;
  return {
    done,
    tasks,
    resched,
    alts,
    late,
    onTime: pct(done.length - late, done.length),
    slow: done.filter((r) => r.daysLate >= 8).length,
    taskDone: tasks.filter((r) => r.done).length,
    taskOpen: tasks.filter((r) => !r.done).length,
    overdueOpen: tasks.filter((r) => !r.done && r.due_date < i.today).length,
    extras: tasks.filter((r) => r.extra),
    postponed: resched.filter((r) => r.delta > 0).length,
    avgDays: resched.length ? resched.reduce((s, r) => s + Math.abs(r.delta), 0) / resched.length : 0,
  };
}

function mdTable(head: string[], rows: (string | number)[][]) {
  return [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)];
}

function lateGroups(rows: Done[], keyOf: (r: Done) => string) {
  const map = new Map<string, { total: number; late: number }>();
  for (const r of rows) {
    const g = map.get(keyOf(r)) ?? { total: 0, late: 0 };
    g.total += 1;
    if (r.late) g.late += 1;
    map.set(keyOf(r), g);
  }
  return [...map.entries()].map(([label, g]) => ({ label, ...g })).sort((a, b) => b.late - a.late);
}

function buildReport(i: ReportInput): string {
  const cur = monthStats(i.ym, i);
  const pm = prevMonth(i.ym);
  const prev = pm ? monthStats(pm, i) : null;
  const stageLabel = new Map<string, string>(STAGES.map((s) => [s.key, s.label]));
  const dec = (n: number) => n.toFixed(1).replace(".", ",");
  const L: string[] = [];

  if (i.withPrompt) {
    L.push(
      "# Instruções para a IA",
      "",
      `Você é analista de operações de uma agência de marketing digital. Abaixo estão os dados reais do sistema referentes a ${monthLabel(i.ym)}. Use SOMENTE esses dados e não invente números. Responda em português, em linguagem simples e direta, com:`,
      "",
      "1. Resumo executivo (até 5 linhas).",
      "2. Pontos críticos, citando os números que os comprovam.",
      "3. O que melhorou e o que piorou em relação ao mês anterior.",
      "4. Pauta da reunião com a equipe, em ordem de prioridade.",
      "5. Ações recomendadas, com responsável sugerido e prazo.",
      "",
      "---",
      ""
    );
  }

  L.push(`# Relatório da operação: ${monthLabel(i.ym)}`, "", `Gerado em ${i.today.split("-").reverse().join("/")}.`, "");

  L.push("## Como ler os dados", "");
  L.push(
    "- Tarefas: tarefas principais do pipeline com prazo no mês (as subtarefas de PDF não entram).",
    "- No prazo: etapa concluída até o dia do prazo. Atrasada: concluída depois do prazo.",
    "- Remarcação: troca da data de uma tarefa. Vale para o responsável da tarefa, não para quem mexeu na data.",
    "- Demanda extra: tarefa marcada como extra no sistema.",
    "- Alterações: o sistema só registra desde 14/10/2026.",
    ""
  );

  L.push("## Resumo do mês", "");
  const dv = (a: number, b: number | undefined, suffix = "") => (b === undefined ? "n/d" : `${a - b > 0 ? "+" : ""}${dec(a - b).replace(",0", "")}${suffix}`);
  const row = (label: string, a: number, b: number | undefined, suffix = ""): (string | number)[] => [label, `${fmt(a)}${suffix}`, b === undefined ? "n/d" : `${fmt(b)}${suffix}`, dv(a, b, suffix === "%" ? " pp" : "")];
  L.push(
    ...mdTable(
      ["Indicador", monthLabel(i.ym), pm ? monthLabel(pm) : "Mês anterior", "Variação"],
      [
        row("Tarefas do mês", cur.tasks.length, prev?.tasks.length),
        row("Tarefas concluídas", cur.taskDone, prev?.taskDone),
        row("Etapas concluídas com prazo", cur.done.length, prev?.done.length),
        row("Etapas no prazo", cur.onTime, prev?.onTime, "%"),
        row("Etapas entregues com atraso", cur.late, prev?.late),
        row("Etapas com 8+ dias de atraso", cur.slow, prev?.slow),
        row("Remarcações de prazo", cur.resched.length, prev?.resched.length),
        row("Remarcações que foram adiamentos", pct(cur.postponed, cur.resched.length), prev ? pct(prev.postponed, prev.resched.length) : undefined, "%"),
        // Alterações só são registradas desde 14/10/2026: antes disso não há base para comparar.
        row("Tarefas enviadas para alteração", cur.alts.length, pm && pm >= "2026-10" ? prev?.alts.length : undefined),
        row("Demandas extras", cur.extras.length, prev?.extras.length),
      ]
    ),
    ""
  );
  if (cur.tasks.length > 0) {
    L.push(`Situação das tarefas do mês: ${fmt(cur.taskDone)} concluídas, ${fmt(cur.taskOpen)} em aberto, ${fmt(cur.overdueOpen)} abertas e já atrasadas.`, "");
  }

  if (cur.done.length > 0) {
    L.push("## Prazos", "");
    L.push("### Por pessoa", "", ...mdTable(["Pessoa", "Etapas", "Atrasadas", "% de atraso"], lateGroups(cur.done, (r) => i.person(r.assigned_user_id)).slice(0, 15).map((g) => [g.label, g.total, g.late, `${pct(g.late, g.total)}%`])), "");
    L.push("### Por cliente", "", ...mdTable(["Cliente", "Etapas", "Atrasadas", "% de atraso"], lateGroups(cur.done, (r) => i.client(r.client_id)).slice(0, 15).map((g) => [g.label, g.total, g.late, `${pct(g.late, g.total)}%`])), "");
    L.push("### Por etapa do pipeline", "", ...mdTable(["Etapa", "Etapas", "Atrasadas", "% de atraso"], lateGroups(cur.done, (r) => stageLabel.get(r.stage) ?? r.stage).sort((a, b) => pct(b.late, b.total) - pct(a.late, a.total)).map((g) => [g.label, g.total, g.late, `${pct(g.late, g.total)}%`])), "");
    const bucket = (a: number, b: number) => cur.done.filter((r) => r.daysLate >= a && r.daysLate <= b).length;
    L.push("### Tempo de atraso", "", ...mdTable(["Faixa", "Etapas"], [["1 a 2 dias", bucket(1, 2)], ["3 a 7 dias", bucket(3, 7)], ["8 a 14 dias", bucket(8, 14)], ["15 dias ou mais", bucket(15, 9999)]]), "");
  }

  if (cur.resched.length > 0) {
    L.push("## Remarcações de prazo", "", `${fmt(cur.resched.length)} remarcações em ${fmt(new Set(cur.resched.map((r) => r.task_id)).size)} tarefas. ${pct(cur.postponed, cur.resched.length)}% foram adiamentos, com ${dec(cur.avgDays)} dias a mais em média.`, "");
    if (i.owners) {
      const owner = i.owners;
      const by = (keyOf: (id: string) => string) => countBy(cur.resched, (r) => (owner[r.task_id] ? keyOf(r.task_id) : REMOVED));
      L.push("### Por responsável da tarefa", "", ...mdTable(["Responsável", "Remarcações"], by((id) => i.person(owner[id].assignee)).slice(0, 15).map((g) => [g.label, g.n])), "");
      L.push("### Por cliente", "", ...mdTable(["Cliente", "Remarcações"], by((id) => i.client(owner[id].client)).slice(0, 15).map((g) => [g.label, g.n])), "");
    }
  }

  if (cur.alts.length > 0) {
    const origin = (key: string) => cur.alts.filter((r) => r.origin === key).length;
    L.push("## Tarefas enviadas para alteração", "", `${fmt(cur.alts.length)} alterações: ${origin("video")} de vídeo, ${origin("design")} de design e ${origin("planejamento")} de planejamento. Em ${cur.alts.filter((r) => !r.requested).length} não consta quem pediu.`, "");
    L.push("### Por cliente", "", ...mdTable(["Cliente", "Alterações"], countBy(cur.alts, (r) => i.client(r.client_id)).slice(0, 15).map((g) => [g.label, g.n])), "");
    L.push("### Por responsável pela alteração", "", ...mdTable(["Responsável", "Alterações"], countBy(cur.alts, (r) => i.person(r.assignee_id)).slice(0, 15).map((g) => [g.label, g.n])), "");
  }

  if (cur.extras.length > 0) {
    L.push("## Demandas extras", "", `${fmt(cur.extras.length)} demandas extras, ${pct(cur.extras.length, cur.tasks.length)}% das tarefas do mês.`, "");
    L.push("### Por cliente", "", ...mdTable(["Cliente", "Demandas extras"], countBy(cur.extras, (r) => i.client(r.client_id)).slice(0, 15).map((g) => [g.label, g.n])), "");
    L.push("### Por responsável", "", ...mdTable(["Responsável", "Demandas extras"], countBy(cur.extras, (r) => i.person(r.assignee_id)).slice(0, 15).map((g) => [g.label, g.n])), "");
  }

  if (cur.tasks.length > 0) {
    L.push("## Volume de tarefas", "");
    L.push("### Por cliente", "", ...mdTable(["Cliente", "Tarefas"], countBy(cur.tasks, (r) => i.client(r.client_id)).slice(0, 15).map((g) => [g.label, g.n])), "");
    L.push("### Por responsável", "", ...mdTable(["Responsável", "Tarefas"], countBy(cur.tasks, (r) => i.person(r.assignee_id)).slice(0, 15).map((g) => [g.label, g.n])), "");
  }

  return L.join("\n").trim() + "\n";
}

// ───────── componente ─────────

export function ReuniaoOperacao() {
  const today = spDate(new Date());
  const [period, setPeriod] = useState<PeriodKey>("90d");
  const [open, setOpen] = useState<BlockKey | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMonth, setReportMonth] = useState<string | null>(null);
  const [withPrompt, setWithPrompt] = useState(true);

  const doneQ = useDoneTasks(today);
  const reschedQ = useRescheduled(today);
  const reschedIds = useMemo(() => [...new Set((reschedQ.data ?? []).filter((r) => r.day >= periodStart(period, today)).map((r) => r.task_id))].sort(), [reschedQ.data, period, today]);
  const ownersQ = useTaskOwners(reschedIds, !!reschedQ.data);
  const tasksQ = useMonthTasks(today);
  const altQ = useAlterations();
  const teamQ = useTeamMembers();
  const clientsQ = useClientsIncludingEnded();

  const names = useMemo(() => new Map((teamQ.data ?? []).map((m) => [m.user_id, m.display_name])), [teamQ.data]);
  const clientNames = useMemo(() => new Map((clientsQ.data ?? []).map((c) => [c.id, c.name])), [clientsQ.data]);
  const person = (id: string | null) => names.get(id ?? "") ?? "Sem responsável";
  const client = (id: string | null) => clientNames.get(id ?? "") ?? "Sem cliente";

  const start = periodStart(period, today);

  // Prazos
  const prazos = useMemo(() => {
    const all = doneQ.data ?? [];
    const rows = all.filter((r) => r.due_date >= start);
    const total = rows.length;
    const late = rows.filter((r) => r.late).length;

    const months = Array.from({ length: 12 }, (_, i) => ({ label: MONTHS[i], total: 0, onTime: 0 }));
    for (const r of all) {
      const m = months[+r.due_date.slice(5, 7) - 1];
      m.total += 1;
      if (!r.late) m.onTime += 1;
    }
    const monthCols: Col[] = months
      .filter((m) => m.total > 0)
      .map((m) => {
        const rate = pct(m.onTime, m.total);
        return { label: m.label, value: rate, color: rate >= 80 ? "bg-emerald-500" : rate >= 65 ? "bg-amber-500" : "bg-red-500" };
      });

    const group = (keyOf: (r: Done) => string) => {
      const map = new Map<string, { label: string; total: number; late: number }>();
      for (const r of rows) {
        const key = keyOf(r);
        const g = map.get(key) ?? { label: key, total: 0, late: 0 };
        g.total += 1;
        if (r.late) g.late += 1;
        map.set(key, g);
      }
      return [...map.values()];
    };
    const stageLabel = new Map<string, string>(STAGES.map((s) => [s.key, s.label]));
    const people = group((r) => person(r.assigned_user_id)).sort((a, b) => b.late - a.late);
    const clients = group((r) => client(r.client_id)).sort((a, b) => b.late - a.late);
    const stages = group((r) => stageLabel.get(r.stage) ?? r.stage).sort((a, b) => pct(b.late, b.total) - pct(a.late, a.total));
    const buckets = [
      { label: "1-2 dias", n: rows.filter((r) => r.daysLate >= 1 && r.daysLate <= 2).length, color: "bg-amber-600" },
      { label: "3-7 dias", n: rows.filter((r) => r.daysLate >= 3 && r.daysLate <= 7).length, color: "bg-orange-600" },
      { label: "8-14 dias", n: rows.filter((r) => r.daysLate >= 8 && r.daysLate <= 14).length, color: "bg-red-500" },
      { label: "15+ dias", n: rows.filter((r) => r.daysLate >= 15).length, color: "bg-red-800" },
    ];
    return { total, late, months, monthCols, people, clients, stages, buckets };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneQ.data, start, names, clientNames]);

  // Remarcações
  const resched = useMemo(() => {
    const all = reschedQ.data ?? [];
    const owners = ownersQ.data ?? {};
    const rows = all.filter((r) => r.day >= start);
    const postponed = rows.filter((r) => r.delta > 0).length;
    const avg = rows.length ? rows.reduce((s, r) => s + Math.abs(r.delta), 0) / rows.length : 0;
    return {
      total: rows.length,
      tasks: new Set(rows.map((r) => r.task_id)).size,
      postponed,
      avg,
      months: monthCols(all.map((r) => r.day), "bg-amber-500"),
      people: countBy(rows, (r) => (owners[r.task_id] ? person(owners[r.task_id].assignee) : REMOVED)),
      clients: countBy(rows, (r) => (owners[r.task_id] ? client(owners[r.task_id].client) : REMOVED)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reschedQ.data, ownersQ.data, start, names, clientNames]);

  // Alterações
  const alt = useMemo(() => {
    const rows = (altQ.data ?? []).filter((r) => r.day >= start);
    const origin = (key: string) => rows.filter((r) => r.origin === key).length;
    return {
      total: rows.length,
      video: origin("video"),
      design: origin("design"),
      plan: origin("planejamento"),
      noRequester: rows.filter((r) => !r.requested).length,
      clients: countBy(rows, (r) => client(r.client_id)),
      people: countBy(rows, (r) => person(r.assignee_id)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [altQ.data, start, names, clientNames]);

  // Tarefas do período e demandas extras (mesma base: tarefas-raiz com prazo no período)
  const tarefas = useMemo(() => {
    const all = tasksQ.data ?? [];
    const end = period === "mes" ? `${today.slice(0, 7)}-31` : today;
    const rows = all.filter((r) => r.due_date >= start && r.due_date <= end);
    const extras = rows.filter((r) => r.extra);

    const perMonth = Array.from({ length: 12 }, () => ({ total: 0, extra: 0 }));
    for (const r of all) {
      const m = perMonth[+r.due_date.slice(5, 7) - 1];
      m.total += 1;
      if (r.extra) m.extra += 1;
    }
    const cols = (pick: (m: { total: number; extra: number }) => number, color: string): Col[] =>
      perMonth.map((m, i) => ({ label: MONTHS[i], value: pick(m), color })).filter((c) => c.value > 0);

    return {
      total: rows.length,
      done: rows.filter((r) => r.done).length,
      open: rows.filter((r) => !r.done).length,
      overdueOpen: rows.filter((r) => !r.done && r.due_date < today).length,
      totalCols: cols((m) => m.total, "bg-sky-500"),
      clients: countBy(rows, (r) => client(r.client_id)),
      people: countBy(rows, (r) => person(r.assignee_id)),
      extra: {
        total: extras.length,
        share: pct(extras.length, rows.length),
        done: extras.filter((r) => r.done).length,
        cols: cols((m) => m.extra, "bg-violet-500"),
        clients: countBy(extras, (r) => client(r.client_id)),
        people: countBy(extras, (r) => person(r.assignee_id)),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksQ.data, start, period, today, names, clientNames]);

  const agenda = useMemo(() => {
    const items: { tone: Tone; text: string }[] = [];
    for (const s of prazos.stages) {
      const rate = pct(s.late, s.total);
      if (s.total >= 20 && rate >= 50) items.push({ tone: "crit", text: `${s.label} atrasa em ${rate}% das entregas (${s.late} de ${s.total})` });
    }
    for (const p of prazos.people.filter((p) => p.label !== "Sem responsável")) {
      const share = pct(p.late, prazos.late);
      const rate = pct(p.late, p.total);
      if (p.late >= 10 && share >= 25) items.push({ tone: "crit", text: `${p.label} concentra ${share}% de todos os atrasos (${p.late} de ${prazos.late})` });
      else if (p.total >= 15 && rate >= 50) items.push({ tone: "warn", text: `${p.label} atrasa ${rate}% do que recebe (${p.late} de ${p.total}). Vale checar carga e tipo de tarefa` });
    }
    for (const c of prazos.clients.filter((c) => c.label !== "Sem cliente")) {
      const rate = pct(c.late, c.total);
      if (c.total >= 10 && rate >= 50) items.push({ tone: "crit", text: `${c.label}: ${c.late} de ${c.total} entregas atrasadas (${rate}%)` });
    }
    if (prazos.buckets[3].n > 0) items.push({ tone: "warn", text: `${prazos.buckets[3].n} ${prazos.buckets[3].n === 1 ? "entrega passou" : "entregas passaram"} de 15 dias de atraso` });
    if (resched.total >= 100 && pct(resched.postponed, resched.total) >= 70) {
      items.push({ tone: "warn", text: `${pct(resched.postponed, resched.total)}% das ${fmt(resched.total)} remarcações foram adiamentos (média de ${resched.avg.toFixed(1).replace(".", ",")} dias)` });
    }
    if (tarefas.total >= 30 && tarefas.extra.share >= 30) {
      items.push({ tone: "warn", text: `Demandas extras são ${tarefas.extra.share}% das tarefas (${fmt(tarefas.extra.total)} de ${fmt(tarefas.total)})` });
    }
    const topExtra = tarefas.extra.clients.find((c) => c.label !== "Sem cliente");
    if (topExtra && tarefas.extra.total >= 30 && pct(topExtra.n, tarefas.extra.total) >= 15) {
      items.push({ tone: "warn", text: `${topExtra.label} concentra ${pct(topExtra.n, tarefas.extra.total)}% das demandas extras (${topExtra.n} de ${tarefas.extra.total})` });
    }
    if (alt.total >= 20 && pct(alt.noRequester, alt.total) >= 50) items.push({ tone: "warn", text: `Em ${alt.noRequester} de ${alt.total} alterações não consta quem pediu` });
    const topAlt = alt.clients.find((c) => c.label !== "Sem cliente");
    if (topAlt && alt.total >= 20 && pct(topAlt.n, alt.total) >= 20) items.push({ tone: "warn", text: `${topAlt.label} concentra ${pct(topAlt.n, alt.total)}% das alterações (${topAlt.n} de ${alt.total})` });
    const cur = prazos.months[+today.slice(5, 7) - 1];
    const prev = prazos.months[+today.slice(5, 7) - 2];
    if (cur && prev && cur.total >= 20 && prev.total >= 20) {
      const a = pct(cur.onTime, cur.total);
      const b = pct(prev.onTime, prev.total);
      if (a >= b + 5) items.push({ tone: "good", text: `${MONTHS[+today.slice(5, 7) - 1]} está com ${a}% no prazo, contra ${b}% em ${MONTHS[+today.slice(5, 7) - 2]}` });
      else if (a <= b - 5) items.push({ tone: "warn", text: `${MONTHS[+today.slice(5, 7) - 1]} está com ${a}% no prazo, abaixo dos ${b}% de ${MONTHS[+today.slice(5, 7) - 2]}` });
    }
    const order: Tone[] = ["crit", "warn", "good"];
    return items.sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone)).slice(0, 8);
  }, [prazos, resched, alt, tarefas, today]);

  // Relatório do mês: mês fechado mais recente por padrão; texto montado só com a janela aberta.
  const reportMonths = useMemo(() => {
    const cur = +today.slice(5, 7);
    return Array.from({ length: cur }, (_, i) => `${today.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`).reverse();
  }, [today]);
  const month = reportMonth ?? (reportMonths[1] ?? reportMonths[0]);
  const reportIds = useMemo(() => [...new Set((reschedQ.data ?? []).filter((r) => r.day.startsWith(month)).map((r) => r.task_id))].sort(), [reschedQ.data, month]);
  const reportOwnersQ = useTaskOwners(reportIds, reportOpen && !!reschedQ.data);
  const reportReady = !!doneQ.data && !!tasksQ.data && !!reschedQ.data && !!altQ.data && (reportIds.length === 0 || !!reportOwnersQ.data);
  const reportText = useMemo(() => {
    if (!reportOpen || !reportReady) return "";
    return buildReport({
      ym: month,
      today,
      done: doneQ.data ?? [],
      tasks: tasksQ.data ?? [],
      resched: reschedQ.data ?? [],
      alts: altQ.data ?? [],
      owners: reportIds.length === 0 ? {} : reportOwnersQ.data ?? null,
      person,
      client,
      withPrompt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportOpen, reportReady, month, withPrompt, doneQ.data, tasksQ.data, reschedQ.data, altQ.data, reportOwnersQ.data, names, clientNames]);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success("Relatório copiado. É só colar na sua IA.");
    } catch {
      toast.error("Não foi possível copiar. Use o botão Baixar ou selecione o texto.");
    }
  };

  const downloadReport = () => {
    const url = URL.createObjectURL(new Blob([reportText], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-operacao-${month}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loading = (q: { isLoading: boolean }) => q.isLoading;
  const onTimeRate = pct(prazos.total - prazos.late, prazos.total);
  const dash = "–";
  const lateTotal = prazos.buckets.reduce((s, b) => s + b.n, 0);
  const slow = prazos.buckets[2].n + prazos.buckets[3].n;
  const originTotal = alt.video + alt.design + alt.plan;

  return (
    <Card>
      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar/10">
              <CalendarCheck className="h-5 w-5 text-sidebar" />
            </div>
            <div>
              <p className="text-sm font-semibold">Reunião da operação</p>
              <p className="text-xs text-muted-foreground">Toque em um bloco para ver o detalhe por pessoa e por cliente.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodKey)} className="w-auto">
              <TabsList className="h-9">
                {PERIODS.map((p) => <TabsTrigger key={p.key} value={p.key} className="px-3 text-xs">{p.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setReportOpen(true)}>
              <FileText className="mr-1.5 h-4 w-4" /> Gerar relatório
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <BlockButton
            wide
            title="Total de tarefas"
            big={loading(tasksQ) ? dash : fmt(tarefas.total)}
            sub={loading(tasksQ) ? "" : "no período"}
            foot={loading(tasksQ) ? undefined : `${fmt(tarefas.done)} concluídas · ${fmt(tarefas.open)} em aberto${tarefas.overdueOpen > 0 ? ` · ${fmt(tarefas.overdueOpen)} atrasadas` : ""}`}
            onClick={() => setOpen("tarefas")}
          >
            <MiniBars cols={tarefas.totalCols} />
          </BlockButton>

          <BlockButton
            title="Prazos"
            big={loading(doneQ) ? dash : prazos.total ? `${onTimeRate}%` : dash}
            bigClass={onTimeRate >= 80 ? "text-emerald-500" : onTimeRate >= 65 ? "text-amber-500" : "text-red-500"}
            sub={loading(doneQ) ? "" : "no prazo"}
            foot={loading(doneQ) ? undefined : `${fmt(prazos.late)} atrasadas de ${fmt(prazos.total)}`}
            onClick={() => setOpen("prazos")}
          >
            <MiniBars cols={prazos.monthCols} />
          </BlockButton>

          <BlockButton
            title="Remarcações"
            big={loading(reschedQ) ? dash : fmt(resched.total)}
            sub={loading(reschedQ) ? "" : "no período"}
            foot={loading(reschedQ) ? undefined : `${pct(resched.postponed, resched.total)}% foram adiadas`}
            onClick={() => setOpen("remarcacoes")}
          >
            <MiniBars cols={resched.months} />
          </BlockButton>

          <BlockButton
            title="Alterações"
            big={loading(altQ) ? dash : fmt(alt.total)}
            sub={loading(altQ) ? "" : "enviadas"}
            foot={loading(altQ) ? undefined : "para alteração"}
            onClick={() => setOpen("alteracoes")}
          >
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" title={`Vídeo ${alt.video} · design ${alt.design} · planejamento ${alt.plan}`}>
              {originTotal > 0 && (
                <>
                  <div className="bg-sky-500" style={{ width: `${(alt.video / originTotal) * 100}%` }} />
                  <div className="bg-amber-500" style={{ width: `${(alt.design / originTotal) * 100}%` }} />
                  <div className="bg-slate-400" style={{ width: `${(alt.plan / originTotal) * 100}%` }} />
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Vídeo {alt.video} · design {alt.design}{alt.plan > 0 ? ` · planejamento ${alt.plan}` : ""}</p>
          </BlockButton>

          <BlockButton
            title="Demandas extras"
            big={loading(tasksQ) ? dash : fmt(tarefas.extra.total)}
            sub={loading(tasksQ) ? "" : "no período"}
            foot={loading(tasksQ) ? undefined : `${tarefas.extra.share}% do total de tarefas`}
            onClick={() => setOpen("extras")}
          >
            <MiniBars cols={tarefas.extra.cols} />
          </BlockButton>
        </div>

        {agenda.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Para levantar na reunião</p>
            <ul className="space-y-2 text-sm">
              {agenda.map((a, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", TONE_CLASS[a.tone])}>{TONE_LABEL[a.tone]}</span>
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <Dialog open={open !== null} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          {open === "prazos" && (
            <>
              <DialogHeader>
                <DialogTitle>Prazos</DialogTitle>
                <DialogDescription>Etapas concluídas no prazo ou com atraso, no período escolhido.</DialogDescription>
              </DialogHeader>
              {doneQ.isError ? (
                <p className="py-8 text-center text-sm text-red-500">Não foi possível carregar os prazos. Tente de novo em instantes.</p>
              ) : prazos.total === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma etapa concluída com prazo neste período.</p>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat value={fmt(prazos.total)} label="Concluídas" />
                    <Stat value={`${onTimeRate}%`} label={`No prazo (${fmt(prazos.total - prazos.late)})`} tone="text-emerald-500" />
                    <Stat value={fmt(prazos.late)} label="Entregues com atraso" tone="text-red-500" />
                    <Stat value={fmt(slow)} label="Com 8+ dias de atraso" tone="text-amber-500" />
                  </div>
                  <Section title={`Entregas no prazo por mês (${today.slice(0, 4)})`}>
                    <MonthChart cols={prazos.monthCols} unit="%" />
                  </Section>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Section title="Atrasos por pessoa" hint="(atrasadas/total)">
                      {prazos.people.slice(0, 12).map((p) => <RateRow key={p.label} {...p} />)}
                      <p className="text-[11px] text-muted-foreground">A barra mostra o % de atraso de cada pessoa.</p>
                    </Section>
                    <Section title="Atrasos por cliente" hint="(os 10 com mais atrasos)">
                      {prazos.clients.slice(0, 10).map((c) => <RateRow key={c.label} {...c} />)}
                    </Section>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Section title="Atraso por etapa do pipeline">
                      {prazos.stages.map((s) => <RateRow key={s.label} {...s} />)}
                    </Section>
                    <Section title={`Quanto passou do prazo (${fmt(lateTotal)} atrasadas)`}>
                      {lateTotal > 0 ? (
                        <>
                          <div className="flex h-7 overflow-hidden rounded-lg">
                            {prazos.buckets.filter((b) => b.n > 0).map((b) => (
                              <div key={b.label} className={b.color} style={{ width: `${(b.n / lateTotal) * 100}%` }} title={`${b.label}: ${b.n}`} />
                            ))}
                          </div>
                          <div className="grid grid-cols-4 text-center text-xs">
                            {prazos.buckets.map((b) => (
                              <div key={b.label}><p className="font-medium tabular-nums">{b.n}</p><p className="text-[11px] text-muted-foreground">{b.label}</p></div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">{pct(prazos.buckets[0].n, lateTotal)}% dos atrasos foram de 1 a 2 dias.</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum atraso no período.</p>
                      )}
                    </Section>
                  </div>
                </div>
              )}
            </>
          )}

          {open === "remarcacoes" && (
            <>
              <DialogHeader>
                <DialogTitle>Remarcações de prazo</DialogTitle>
                <DialogDescription>Cada vez que a data de uma tarefa foi trocada, no período escolhido.</DialogDescription>
              </DialogHeader>
              {reschedQ.isError ? (
                <p className="py-8 text-center text-sm text-red-500">Não foi possível carregar as remarcações. Tente de novo em instantes.</p>
              ) : resched.total === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma remarcação neste período.</p>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat value={fmt(resched.total)} label="Remarcações" />
                    <Stat value={fmt(resched.tasks)} label="Tarefas diferentes" />
                    <Stat value={`${pct(resched.postponed, resched.total)}%`} label="Foram adiadas" tone="text-red-500" />
                    <Stat value={resched.avg.toFixed(1).replace(".", ",")} label="Dias a mais, em média" />
                  </div>
                  <Section title={`Remarcações por mês (${today.slice(0, 4)})`}>
                    <MonthChart cols={resched.months} />
                  </Section>
                  {ownersQ.isError ? (
                    <p className="text-sm text-red-500">Não foi possível identificar o responsável das tarefas remarcadas.</p>
                  ) : ownersQ.isLoading ? (
                    <p className="text-sm text-muted-foreground">Identificando o responsável de cada tarefa…</p>
                  ) : (
                    <div className="grid gap-5 md:grid-cols-2">
                      <Section title="Por responsável" hint="(dono da tarefa remarcada)">
                        <CountRows items={resched.people.slice(0, 12)} barClass="bg-amber-500" />
                      </Section>
                      <Section title="Por cliente" hint="(os 10 com mais remarcações)">
                        <CountRows items={resched.clients.slice(0, 10)} barClass="bg-amber-500" />
                      </Section>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {open === "alteracoes" && (
            <>
              <DialogHeader>
                <DialogTitle>Tarefas enviadas para alteração</DialogTitle>
                <DialogDescription>O sistema registra alterações desde 14/out, então a base ainda é curta.</DialogDescription>
              </DialogHeader>
              {altQ.isError ? (
                <p className="py-8 text-center text-sm text-red-500">Não foi possível carregar as alterações. Tente de novo em instantes.</p>
              ) : alt.total === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma alteração neste período.</p>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat value={fmt(alt.total)} label="Alterações" />
                    <Stat value={fmt(alt.video)} label={`De vídeo (${pct(alt.video, alt.total)}%)`} />
                    <Stat value={fmt(alt.design)} label={`De design (${pct(alt.design, alt.total)}%)`} />
                    <Stat value={fmt(alt.plan)} label="De planejamento" />
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Section title="Por cliente">
                      <CountRows items={alt.clients.slice(0, 10)} barClass="bg-sky-500" />
                    </Section>
                    <Section title="Quem refez" hint="(responsável pela alteração)">
                      <CountRows items={alt.people.slice(0, 10)} barClass="bg-amber-500" />
                    </Section>
                  </div>
                  <p className="text-xs text-muted-foreground">Em {alt.noRequester} de {alt.total} alterações não consta quem pediu nem o motivo.</p>
                </div>
              )}
            </>
          )}

          {open === "extras" && (
            <>
              <DialogHeader>
                <DialogTitle>Demandas extras</DialogTitle>
                <DialogDescription>Tarefas fora do pacote contratado, no período escolhido.</DialogDescription>
              </DialogHeader>
              {tasksQ.isError ? (
                <p className="py-8 text-center text-sm text-red-500">Não foi possível carregar as demandas extras. Tente de novo em instantes.</p>
              ) : tarefas.extra.total === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma demanda extra neste período.</p>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat value={fmt(tarefas.extra.total)} label="Demandas extras" />
                    <Stat value={`${tarefas.extra.share}%`} label="Do total de tarefas" tone="text-violet-500" />
                    <Stat value={fmt(tarefas.extra.done)} label="Concluídas" />
                    <Stat value={fmt(tarefas.extra.total - tarefas.extra.done)} label="Em aberto" />
                  </div>
                  <Section title={`Demandas extras por mês (${today.slice(0, 4)})`}>
                    <MonthChart cols={tarefas.extra.cols} />
                  </Section>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Section title="Por cliente" hint="(os 10 com mais extras)">
                      <CountRows items={tarefas.extra.clients.slice(0, 10)} barClass="bg-violet-500" />
                    </Section>
                    <Section title="Por responsável">
                      <CountRows items={tarefas.extra.people.slice(0, 10)} barClass="bg-violet-500" />
                    </Section>
                  </div>
                </div>
              )}
            </>
          )}

          {open === "tarefas" && (
            <>
              <DialogHeader>
                <DialogTitle>Total de tarefas</DialogTitle>
                <DialogDescription>Tarefas do pipeline com prazo no período escolhido (as subtarefas de PDF não entram na conta).</DialogDescription>
              </DialogHeader>
              {tasksQ.isError ? (
                <p className="py-8 text-center text-sm text-red-500">Não foi possível carregar as tarefas. Tente de novo em instantes.</p>
              ) : tarefas.total === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa neste período.</p>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat value={fmt(tarefas.total)} label="Tarefas" />
                    <Stat value={fmt(tarefas.done)} label={`Concluídas (${pct(tarefas.done, tarefas.total)}%)`} tone="text-emerald-500" />
                    <Stat value={fmt(tarefas.open)} label="Em aberto" />
                    <Stat value={fmt(tarefas.overdueOpen)} label="Abertas e atrasadas" tone={tarefas.overdueOpen > 0 ? "text-red-500" : undefined} />
                  </div>
                  <Section title={`Tarefas por mês (${today.slice(0, 4)})`}>
                    <MonthChart cols={tarefas.totalCols} />
                  </Section>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Section title="Por cliente" hint="(os 10 com mais tarefas)">
                      <CountRows items={tarefas.clients.slice(0, 10)} barClass="bg-sky-500" />
                    </Section>
                    <Section title="Por responsável">
                      <CountRows items={tarefas.people.slice(0, 10)} barClass="bg-sky-500" />
                    </Section>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório do mês</DialogTitle>
            <DialogDescription>Texto pronto com todos os dados do mês. Copie e cole na sua IA para ela montar a análise e a pauta.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={month} onValueChange={setReportMonth}>
              <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {reportMonths.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={withPrompt} onCheckedChange={(v) => setWithPrompt(v === true)} />
              Incluir instruções para a IA
            </label>
          </div>
          {doneQ.isError || tasksQ.isError || reschedQ.isError || altQ.isError || reportOwnersQ.isError ? (
            <p className="py-8 text-center text-sm text-red-500">Não foi possível reunir os dados do mês. Tente de novo em instantes.</p>
          ) : !reportReady ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reunindo os dados do mês…</p>
          ) : (
            <>
              <textarea
                readOnly
                value={reportText}
                onFocus={(e) => e.currentTarget.select()}
                className="h-[48vh] w-full resize-none rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={downloadReport}><Download className="mr-1.5 h-4 w-4" /> Baixar (.md)</Button>
                <Button type="button" onClick={() => void copyReport()}><Copy className="mr-1.5 h-4 w-4" /> Copiar para a IA</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
