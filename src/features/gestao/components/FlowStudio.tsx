import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Clock, Eye, EyeOff, LayoutTemplate, Plus, RotateCcw, Trash2, TriangleAlert, UserRound, Workflow } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGE_CIRCLE_COLORS, STAGE_PALETTE, type FlowStageRow } from "../pm-constants";
import { useFlowStages } from "../StageCatalogProvider";
import { FLOW_TEMPLATES, type FlowTemplate } from "../flow-templates";
import { useStageFlows, type StageFlow } from "./PmStageFlowConfig";
import { useCargos } from "@/hooks/use-cargos";
import { useSaveStageRoles, useStageRoles } from "../hooks/use-stage-roles";

const sb = supabase as any;
const FINAL_KEY = "entrega"; // the "done" stage: always present, always last
const NO_NEXT = ["entrega", "alteracoes"]; // stages that don't point to a next one
const NO_DATE = ["entrega", "alteracoes"];

type DateMode = "none" | "pick" | number;
type Draft = {
  key: string; label: string; color: string | null; kind: string; is_system: boolean; active: boolean;
  next: string[]; date: DateMode;
};

const DATE_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Sem prazo novo" },
  { value: "pick", label: "Escolher a data" },
  { value: "1", label: "+1 dia" },
  { value: "2", label: "+2 dias" },
  { value: "3", label: "+3 dias" },
  { value: "5", label: "+5 dias" },
  { value: "7", label: "+7 dias" },
];

const NEUTRAL_TONE = { border: "border-muted-foreground/50", bg: "bg-muted-foreground/40", text: "text-muted-foreground" };
// The color a stage shows: the owner's pick, else the built-in color the stage always had, else neutral.
const toneOf = (d: { key: string; color: string | null }) => (d.color ? STAGE_PALETTE[d.color] : STAGE_CIRCLE_COLORS[d.key] ?? NEUTRAL_TONE);

function slugify(label: string) {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 36);
}

function useOpenTasksByStage() {
  return useQuery({
    queryKey: ["flow_open_tasks_by_stage"],
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await sb
        .from("pm_tasks").select("stage_current")
        .is("deleted_at", null).is("parent_task_id", null).neq("status_global", "concluido").limit(20000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of (data ?? []) as { stage_current: string }[]) counts[r.stage_current] = (counts[r.stage_current] ?? 0) + 1;
      return counts;
    },
  });
}

function buildDraft(rows: FlowStageRow[], flow: StageFlow | undefined): Draft[] {
  const cfg = (flow?.flow_config ?? {}) as Record<string, string | string[]>;
  const dates = (flow?.transition_dates ?? {}) as Record<string, "pick" | number>;
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => {
      const n = cfg[r.key];
      return {
        key: r.key, label: r.label, color: r.color, kind: r.kind, is_system: r.is_system, active: r.active,
        next: n === undefined ? [] : Array.isArray(n) ? n : [n],
        date: dates[r.key] ?? "none",
      };
    });
}

// Template → draft: template stages first (in order; re-labelled or created), everything else hidden below.
function draftFromTemplate(current: Draft[], t: FlowTemplate): Draft[] {
  const byKey = new Map(current.map((d) => [d.key, d]));
  const inTemplate = new Set(t.stages.map((s) => s.key));
  const head: Draft[] = t.stages.map((s) => {
    const existing = byKey.get(s.key);
    const noDate = NO_DATE.includes(s.key);
    return {
      key: s.key,
      label: s.label,
      color: existing?.is_system ? existing.color : s.color ?? existing?.color ?? null,
      kind: existing?.kind ?? "work",
      is_system: existing?.is_system ?? false,
      active: true,
      next: t.next[s.key] ? [t.next[s.key]] : [],
      date: noDate ? "none" : existing ? (existing.active ? existing.date : 1) : 1,
    };
  });
  const tail: Draft[] = current.filter((d) => !inTemplate.has(d.key)).map((d) => ({ ...d, active: false, next: [] }));
  return [...head, ...tail];
}

function ColorDot({ stage, onChange, size = "md" }: { stage: { key: string; color: string | null }; onChange: (c: string | null) => void; size?: "sm" | "md" }) {
  const tone = toneOf(stage);
  const dim = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  const isFinal = stage.key === FINAL_KEY;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Cor da etapa" className={cn("z-10 grid shrink-0 place-items-center rounded-full border-2 bg-background transition hover:scale-110", dim, tone.border, isFinal && tone.bg)}>
          {isFinal && size === "md" && <Check className="h-3 w-3 text-white" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div className="grid grid-cols-7 gap-2">
          {Object.keys(STAGE_PALETTE).map((c) => (
            <button key={c} type="button" aria-label={c} onClick={() => onChange(c)} className={cn("grid h-6 w-6 place-items-center rounded-full", STAGE_PALETTE[c].bg)}>
              {stage.color === c && <Check className="h-3 w-3 text-white" />}
            </button>
          ))}
        </div>
        <button type="button" className="mt-3 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => onChange(null)}>Cor padrão</button>
      </PopoverContent>
    </Popover>
  );
}

function NextPicker({ stage, options, onToggle }: { stage: Draft; options: Draft[]; onToggle: (key: string) => void }) {
  const chosen = stage.next.map((k) => options.find((o) => o.key === k)).filter(Boolean) as Draft[];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex min-h-7 max-w-full flex-wrap items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted/60 hover:text-foreground">
          <ArrowRight className="h-3 w-3 shrink-0" />
          {chosen.length === 0 ? (
            <span className="text-amber-600 dark:text-amber-400">escolher a próxima</span>
          ) : (
            chosen.map((c, i) => (
              <span key={c.key} className="flex items-center gap-1.5">
                {i > 0 && <span className="opacity-60">ou</span>}
                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">
                  <span className={cn("h-1.5 w-1.5 rounded-full", toneOf(c).bg)} />
                  {c.label}
                </span>
              </span>
            ))
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <p className="px-2 pb-1.5 pt-1 text-[11px] text-muted-foreground">Ao concluir "{stage.label}", a tarefa vai para… (marque mais de uma para escolher na hora)</p>
        <div className="max-h-64 overflow-y-auto">
          {options.map((o) => (
            <label key={o.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
              <Checkbox checked={stage.next.includes(o.key)} onCheckedChange={() => onToggle(o.key)} className="h-4 w-4" />
              <span className={cn("h-2 w-2 rounded-full", toneOf(o).bg)} />
              {o.label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const ALTERATION_ROLE_KEYS: { key: string; label: string }[] = [
  { key: "alteracao_pauta", label: "do Planejamento" },
  { key: "alteracao_design", label: "do Design" },
  { key: "alteracao_video", label: "do Vídeo" },
];
const REVIEW_ROLE_KEYS: { key: string; label: string }[] = [
  { key: "revisao_pauta", label: "do Planejamento" },
  { key: "revisao_design", label: "do Design" },
  { key: "revisao_video", label: "do Vídeo" },
];

// Which cargo answers for a stage: the person of that cargo in each client's team takes the task when it gets here.
function RoleSelect({ value, cargos, onChange, label }: { value: string | null; cargos: string[]; onChange: (v: string | null) => void; label?: string }) {
  // a saved cargo that was later removed from the cargo list still shows up, so nothing silently changes
  const options = value && !cargos.includes(value) ? [...cargos, value] : cargos;
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>}
      <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
        <SelectTrigger className={cn("h-7 w-auto gap-1.5 rounded-lg border-0 px-2 text-xs shadow-none hover:bg-muted/60", value ? "bg-primary/10 text-primary" : "bg-transparent text-amber-600 dark:text-amber-400")}>
          <UserRound className="h-3 w-3" /> <SelectValue placeholder="Escolher o cargo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" className="text-xs text-muted-foreground">Sem cargo</SelectItem>
          {options.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TemplateCard({ t, onUse }: { t: FlowTemplate; onUse: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/40 p-4 transition-colors hover:border-primary/40">
      <div>
        <p className="text-sm font-semibold">{t.name}</p>
        <p className="text-[11px] text-muted-foreground">{t.audience}</p>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t.description}</p>
      <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
        {t.stages.filter((s) => s.key !== "alteracoes").map((s, i, arr) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">{s.label}</span>
            {i < arr.length - 1 && <ArrowRight className="h-2.5 w-2.5" />}
          </span>
        ))}
      </div>
      {t.note && <p className="text-[11px] italic text-muted-foreground">{t.note}</p>}
      <Button variant="outline" size="sm" className="mt-auto w-fit rounded-full" onClick={onUse}>Usar este modelo</Button>
    </div>
  );
}

export function FlowStudio() {
  const qc = useQueryClient();
  const stagesQ = useFlowStages();
  const flowsQ = useStageFlows();
  const openQ = useOpenTasksByStage();
  const flow = useMemo(() => (flowsQ.data ?? []).find((f) => f.is_default) ?? (flowsQ.data ?? [])[0], [flowsQ.data]);

  // Wait for BOTH the stage catalog and the flow: the draft needs each stage's "next" from the flow.
  const ready = !!stagesQ.data && flowsQ.isSuccess;
  const original = useMemo(() => (ready ? buildDraft(stagesQ.data!, flow) : null), [ready, stagesQ.data, flow]);
  const originalSig = original ? JSON.stringify(original) : null;
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const baseSig = useRef<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  // The flow board can be minimized to a one-line overview (remembered on this browser)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("fluxo-flow-board-collapsed") === "1"; } catch { return false; }
  });
  // Cargo of each stage: only the edits are kept here; the saved/default map comes from the server
  const rolesQ = useStageRoles();
  const cargosQ = useCargos();
  const saveRoles = useSaveStageRoles();
  const [roleEdits, setRoleEdits] = useState<Record<string, string | null>>({});
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      try { localStorage.setItem("fluxo-flow-board-collapsed", v ? "0" : "1"); } catch { /* preference only */ }
      return !v;
    });

  // (Re)load the draft from the saved flow — but never throw away edits already made.
  useEffect(() => {
    if (!original || !originalSig) return;
    if (draft === null || JSON.stringify(draft) === baseSig.current) {
      setDraft(original);
      baseSig.current = originalSig;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalSig]);

  if (!draft || !original) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando o fluxo…</div>;
  }

  const open = openQ.data ?? {};
  const savedRoles = rolesQ.data ?? {};
  const roles: Record<string, string | null> = { ...savedRoles, ...roleEdits };
  const changedRoles = Object.fromEntries(Object.entries(roleEdits).filter(([k, v]) => (savedRoles[k] ?? null) !== v));
  const rolesDirty = Object.keys(changedRoles).length > 0;
  const cargoLabels = (cargosQ.data ?? []).map((c) => c.label);
  const setRole = (stageKey: string, role: string | null) => setRoleEdits((e) => ({ ...e, [stageKey]: role }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(original) || rolesDirty;
  const activeList = draft.filter((d) => d.active);
  const hiddenList = draft.filter((d) => !d.active);

  const blockers = draft.filter((d) => {
    const was = original.find((o) => o.key === d.key);
    return was?.active && !d.active && (open[d.key] ?? 0) > 0;
  });
  const missingNext = activeList.filter((d) => !NO_NEXT.includes(d.key) && !d.next.some((k) => activeList.some((a) => a.key === k && a.key !== d.key)));
  const noFinal = !activeList.some((d) => d.key === FINAL_KEY);
  const problems = [
    ...blockers.map((b) => `"${original.find((o) => o.key === b.key)?.label}" ainda tem ${open[b.key]} tarefa(s) aberta(s) — conclua ou mova antes de ocultar.`),
    ...missingNext.map((d) => `"${d.label}" precisa apontar para uma etapa seguinte.`),
    ...(noFinal ? ["A etapa final (Entregue/Concluído) precisa ficar ativa."] : []),
  ];

  const patch = (key: string, changes: Partial<Draft>) => setDraft((d) => d!.map((x) => (x.key === key ? { ...x, ...changes } : x)));
  const toggleNext = (key: string, nextKey: string) =>
    setDraft((d) => d!.map((x) => (x.key !== key ? x : { ...x, next: x.next.includes(nextKey) ? x.next.filter((k) => k !== nextKey) : [...x.next, nextKey] })));

  // Reordering moves a stage past its neighbour among the VISIBLE stages.
  const move = (key: string, dir: -1 | 1) =>
    setDraft((d) => {
      const arr = [...d!];
      const i = arr.findIndex((x) => x.key === key);
      let j = i + dir;
      while (j >= 0 && j < arr.length && !arr[j].active) j += dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });

  const hide = (d: Draft) => {
    if ((open[d.key] ?? 0) > 0 && original.find((o) => o.key === d.key)?.active) {
      toast.error(`Há ${open[d.key]} tarefa(s) aberta(s) em "${d.label}".`);
      return;
    }
    setDraft((cur) => cur!.map((x) => (x.key === d.key ? { ...x, active: false, next: [] } : { ...x, next: x.next.filter((k) => k !== d.key) })));
  };
  const show = (d: Draft) => patch(d.key, { active: true });

  const addStage = () => {
    const label = newLabel.trim();
    if (!label) return;
    let key = slugify(label) || "etapa";
    const taken = new Set(draft.map((d) => d.key).concat(["roteiro", "edicao"]));
    let n = 2;
    const base = key;
    while (taken.has(key)) key = `${base}_${n++}`;
    const finalIdx = draft.findIndex((d) => d.key === FINAL_KEY);
    const arr = [...draft];
    arr.splice(finalIdx < 0 ? arr.length : finalIdx, 0, { key, label, color: null, kind: "work", is_system: false, active: true, next: [FINAL_KEY], date: 1 });
    setDraft(arr);
    setNewLabel("");
    setAdding(false);
  };

  const removeStage = (d: Draft) => {
    if ((open[d.key] ?? 0) > 0) { toast.error(`Há ${open[d.key]} tarefa(s) aberta(s) nesta etapa.`); return; }
    setDraft((cur) => cur!.filter((x) => x.key !== d.key).map((x) => ({ ...x, next: x.next.filter((k) => k !== d.key) })));
  };

  const useTemplate = (t: FlowTemplate) => {
    setDraft(draftFromTemplate(draft, t));
    setTemplatesOpen(false);
    toast.success(`Modelo "${t.name}" carregado. Revise e clique em Salvar.`);
  };

  const discard = () => { setDraft(original); setRoleEdits({}); };

  const save = async () => {
    if (problems.length) { toast.error(problems[0]); return; }
    setSaving(true);
    try {
      const { data: agencyId, error: aErr } = await sb.rpc("current_agency_id");
      if (aErr || !agencyId) throw new Error("Não foi possível identificar a agência.");
      const now = new Date().toISOString();
      // Tasks can only sit in a stage whose key exists in the database's stage type: register the new ones first.
      const customKeys = draft.filter((d) => !d.is_system).map((d) => d.key);
      if (customKeys.length) {
        const { error: enumErr } = await sb.rpc("ensure_pm_stage_values", { p_keys: customKeys });
        if (enumErr) throw enumErr;
      }
      const rows = draft.map((d, i) => ({
        agency_id: agencyId, key: d.key, label: d.label.trim() || d.key, color: d.color, kind: d.kind, is_system: d.is_system, active: d.active, sort_order: i, updated_at: now,
      }));
      const { error: upErr } = await sb.from("flow_stages").upsert(rows, { onConflict: "agency_id,key" });
      if (upErr) throw upErr;
      const removed = original.filter((o) => !o.is_system && !draft.some((d) => d.key === o.key)).map((o) => o.key);
      if (removed.length) {
        const { error: delErr } = await sb.from("flow_stages").delete().eq("agency_id", agencyId).in("key", removed);
        if (delErr) throw delErr;
      }

      const flowConfig: Record<string, string | string[]> = {};
      const transition: Record<string, "pick" | number> = {};
      for (const d of draft) {
        if (!d.active) continue;
        const nexts = d.next.filter((k) => activeList.some((a) => a.key === k));
        if (!NO_NEXT.includes(d.key) && nexts.length) flowConfig[d.key] = nexts.length === 1 ? nexts[0] : nexts;
        if (!NO_DATE.includes(d.key) && d.date !== "none") transition[d.key] = d.date;
      }
      if (flow) {
        const { error } = await sb.from("pm_stage_flows").update({ flow_config: flowConfig, transition_dates: transition, updated_at: now }).eq("id", flow.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("pm_stage_flows").insert({ name: "Fluxo Padrão", flow_config: flowConfig, transition_dates: transition, stage_assignees: {}, is_default: true });
        if (error) throw error;
      }
      if (rolesDirty) await saveRoles.mutateAsync(changedRoles);
      setRoleEdits({});
      toast.success("Fluxo salvo!");
      await qc.invalidateQueries({ queryKey: ["pm_stage_flows"] });
      await qc.invalidateQueries({ queryKey: ["flow_stages"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o fluxo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Workflow className="h-5 w-5 text-muted-foreground" /> Fluxo de etapas
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{activeList.length}</span>
          </h3>
          <p className="text-sm text-muted-foreground">O caminho que cada tarefa percorre, do primeiro passo até a entrega.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 rounded-full" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate className="h-4 w-4" /> Modelos prontos
          </Button>
          <Button variant="outline" size="icon" className="rounded-full" onClick={toggleCollapsed} aria-expanded={!collapsed} aria-label={collapsed ? "Expandir o fluxo" : "Minimizar o fluxo"} title={collapsed ? "Expandir" : "Minimizar"}>
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", !collapsed && "rotate-180")} />
          </Button>
        </div>
      </div>

      {collapsed ? (
        // Minimized: the whole path in one glance
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-3xl border border-border/40 bg-card/40 px-4 py-3.5">
          {activeList.map((d, idx) => (
            <span key={d.key} className="flex items-center gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium">
                <span className={cn("h-2 w-2 rounded-full", toneOf(d).bg)} />
                {d.label}
                {(open[d.key] ?? 0) > 0 && <span className="text-[10px] text-amber-600 dark:text-amber-400">{open[d.key]}</span>}
              </span>
              {idx < activeList.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/60" />}
            </span>
          ))}
        </div>
      ) : (
      <div className="rounded-3xl border border-border/40 bg-card/30 p-3 sm:p-5">
        <ol className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {activeList.map((d, idx) => {
            const isFinal = d.key === FINAL_KEY;
            const last = idx === activeList.length - 1;
            const count = open[d.key] ?? 0;
            const tone = toneOf(d);
            const options = activeList.filter((a) => a.key !== d.key && a.key !== "alteracoes");
            return (
              <li key={d.key} className="group relative">
                <div className="relative h-full overflow-hidden rounded-2xl border border-border/50 bg-card px-4 pb-3.5 pt-5 shadow-sm transition hover:border-border hover:shadow-md">
                  <span className={cn("absolute inset-x-0 top-0 h-1", tone.bg)} />

                  <div className="flex items-start gap-3">
                    <ColorDot stage={d} onChange={(c) => patch(d.key, { color: c })} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa {String(idx + 1).padStart(2, "0")}</p>
                      <input
                        value={d.label}
                        onChange={(e) => patch(d.key, { label: e.target.value })}
                        maxLength={40}
                        aria-label="Nome da etapa"
                        className="-ml-1.5 w-full rounded-md bg-transparent px-1.5 py-0.5 text-base font-semibold tracking-tight outline-none transition focus:bg-background focus:ring-1 focus:ring-border"
                      />
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {count > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">{count} aberta{count > 1 ? "s" : ""}</span>}
                        {!d.is_system && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Personalizada</span>}
                      </div>
                    </div>
                  </div>

                  {!isFinal && (
                    <div className="mt-3 space-y-0.5 border-t border-border/40 pt-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cargo responsável</p>
                      {d.key === "revisao" ? (
                        REVIEW_ROLE_KEYS.map((r) => <RoleSelect key={r.key} label={r.label} value={roles[r.key] ?? null} cargos={cargoLabels} onChange={(v) => setRole(r.key, v)} />)
                      ) : d.key === "alteracoes" ? (
                        ALTERATION_ROLE_KEYS.map((r) => <RoleSelect key={r.key} label={r.label} value={roles[r.key] ?? null} cargos={cargoLabels} onChange={(v) => setRole(r.key, v)} />)
                      ) : (
                        <RoleSelect value={roles[d.key] ?? null} cargos={cargoLabels} onChange={(v) => setRole(d.key, v)} />
                      )}
                    </div>
                  )}

                  {d.key !== "alteracoes" && (
                  <div className="mt-3 border-t border-border/40 pt-2.5">
                    {isFinal ? (
                      <p className="text-xs text-muted-foreground">Fim do fluxo: a tarefa sai da produção.</p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <NextPicker stage={d} options={options} onToggle={(k) => toggleNext(d.key, k)} />
                        <Select value={d.date === "none" ? "none" : String(d.date)} onValueChange={(v) => patch(d.key, { date: v === "none" ? "none" : v === "pick" ? "pick" : Number(v) })}>
                          <SelectTrigger className="h-7 w-auto gap-1.5 rounded-lg border-0 bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground">
                            <Clock className="h-3 w-3" /> <SelectValue />
                          </SelectTrigger>
                          <SelectContent>{DATE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  )}

                  <div className="absolute right-2 top-3 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button type="button" aria-label="Subir" disabled={idx === 0} onClick={() => move(d.key, -1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25"><ArrowLeft className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Descer" disabled={last || (activeList[idx + 1]?.key === FINAL_KEY)} onClick={() => move(d.key, 1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25"><ArrowRight className="h-3.5 w-3.5" /></button>
                    {!isFinal && <button type="button" aria-label="Ocultar etapa" onClick={() => hide(d)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><EyeOff className="h-3.5 w-3.5" /></button>}
                    {!d.is_system && <button type="button" aria-label="Excluir etapa" onClick={() => removeStage(d)} className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>

                {/* Connector to the next stage: down on one column, right where the next card sits beside this one */}
                {!last && (
                  <>
                    <span className="absolute -bottom-[1.4rem] left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground sm:hidden"><ArrowDown className="h-3 w-3" /></span>
                    {idx % 2 === 0 && <span className="absolute -right-[1.65rem] top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground sm:flex xl:hidden"><ArrowRight className="h-3 w-3" /></span>}
                    {idx % 3 !== 2 && <span className="absolute -right-[1.65rem] top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground xl:flex"><ArrowRight className="h-3 w-3" /></span>}
                  </>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/30 pt-4">
          {adding ? (
            <>
              <Input autoFocus value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addStage(); if (e.key === "Escape") setAdding(false); }} maxLength={40} placeholder="Nome da etapa (ex.: Briefing)" className="h-9 w-64 rounded-full" />
              <Button size="sm" className="rounded-full" disabled={!newLabel.trim()} onClick={addStage}>Adicionar</Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => { setAdding(false); setNewLabel(""); }}>Cancelar</Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Adicionar etapa</Button>
          )}
        </div>
      </div>
      )}

      {hiddenList.length > 0 && (
        <div className="rounded-2xl border border-border/30">
          <button type="button" onClick={() => setHiddenOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground">
            <EyeOff className="h-4 w-4" /> Etapas ocultas <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{hiddenList.length}</span>
            <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", hiddenOpen && "rotate-180")} />
          </button>
          {hiddenOpen && (
            <ul className="divide-y divide-border/30 border-t border-border/30">
              {hiddenList.map((d) => (
                <li key={d.key} className="flex items-center gap-3 px-4 py-2.5">
                  <ColorDot stage={d} onChange={(c) => patch(d.key, { color: c })} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{d.label}</span>
                  {(open[d.key] ?? 0) > 0 && <span className="text-[11px] text-amber-600 dark:text-amber-400">{open[d.key]} aberta(s)</span>}
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full text-xs" onClick={() => show(d)}><Eye className="h-3.5 w-3.5" /> Mostrar</Button>
                  {!d.is_system && <button type="button" aria-label="Excluir etapa" onClick={() => removeStage(d)} className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Save bar */}
      {dirty && (
        <div className="sticky bottom-4 z-20 flex justify-center px-2">
          <div className="flex max-w-full flex-wrap items-center gap-3 rounded-full border border-border/60 bg-background/90 py-2 pl-5 pr-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
            {problems.length > 0 ? (
              <span className="flex min-w-0 items-center gap-2 text-xs text-amber-600 dark:text-amber-400"><TriangleAlert className="h-4 w-4 shrink-0" /><span className="truncate">{problems[0]}</span></span>
            ) : (
              <span className="text-xs text-muted-foreground">Alterações não salvas — valem para o sistema inteiro.</span>
            )}
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full" onClick={discard}><RotateCcw className="h-3.5 w-3.5" /> Descartar</Button>
            <Button size="sm" className="rounded-full px-5" disabled={saving || problems.length > 0} onClick={save}>{saving ? "Salvando…" : "Salvar fluxo"}</Button>
          </div>
        </div>
      )}

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Modelos prontos</DialogTitle>
            <DialogDescription>Escolha o que mais se parece com o seu trabalho. O modelo vira um rascunho: você ajusta e só vale depois de salvar.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {FLOW_TEMPLATES.map((t) => <TemplateCard key={t.id} t={t} onUse={() => useTemplate(t)} />)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
