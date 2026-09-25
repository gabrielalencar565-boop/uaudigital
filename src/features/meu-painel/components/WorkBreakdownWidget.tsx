import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { stageLabel, tagDisplay } from "@/features/gestao/pm-constants";
import { usePeriodicStages, isPeriodicStageKey } from "@/features/gestao/hooks/use-periodic-stages";
import { useMyChildTasks } from "@/features/gestao/hooks/use-pm-data";
import type { PmTask } from "@/features/gestao/pm-types";

interface Props {
  allTasks: PmTask[];
  month: Date;
  userId?: string;
}

// Estágios cujo conteúdo é diferenciado por etiqueta (post, carrossel, vídeo curto…).
// A etiqueta quase sempre mora na SUBTAREFA (o vídeo/design em si), não na tarefa mãe
// — por isso essas duas viram um bucket expansível com o detalhamento por etiqueta.
const TAG_DRIVEN_STAGES = new Set(["design", "edicao_videos"]);
const NO_TAG_LABEL = "Sem etiqueta";

interface Bucket {
  label: string;
  count: number;
  subBreakdown?: { label: string; count: number }[];
}

function baseGroupLabel(task: PmTask, periodicLabels: Map<string, string>): string {
  if (task.periodic_stage_key && isPeriodicStageKey(task.periodic_stage_key)) {
    return periodicLabels.get(task.periodic_stage_key) ?? task.periodic_stage_key;
  }
  return stageLabel(task.stage_current);
}

export function WorkBreakdownWidget({ allTasks, month, userId }: Props) {
  const periodicStagesQ = usePeriodicStages();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const periodicLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of periodicStagesQ.data ?? []) m.set(p.key, p.label);
    return m;
  }, [periodicStagesQ.data]);

  const tasks = useMemo(() => {
    if (!userId) return [];
    const startKey = format(startOfMonth(month), "yyyy-MM-dd");
    const endKey = format(endOfMonth(month), "yyyy-MM-dd");
    return allTasks.filter((t) =>
      (t.assignee_id === userId || (t.watchers ?? []).includes(userId)) &&
      t.status_global !== "cancelado" &&
      !(t as any).is_draft &&
      !!t.due_date && t.due_date >= startKey && t.due_date <= endKey
    );
  }, [allTasks, userId, month]);

  // Only the finished tasks' ids can have relevant children (see `relevantChildren` below) —
  // scoping useMyChildTasks to these instead of pulling every subtask in the company (what
  // usePmAllChildTasks did here before) is what keeps this dashboard widget cheap.
  const doneParentIds = useMemo(
    () => tasks.filter((t) => t.status_global === "concluido").map((t) => t.id),
    [tasks],
  );
  const childrenQ = useMyChildTasks(userId, doneParentIds);

  const breakdown = useMemo<Bucket[]>(() => {
    const doneParents = tasks.filter((t) => t.status_global === "concluido");
    const parentIds = new Set(doneParents.map((t) => t.id));
    const relevantChildren = (childrenQ.data ?? []).filter(
      (c) => c.parent_task_id && parentIds.has(c.parent_task_id) && c.status_global === "concluido",
    );
    const parentById = new Map(doneParents.map((t) => [t.id, t]));

    const simpleCounts = new Map<string, number>();
    const tagStageCounts = new Map<string, Map<string, number>>();

    const addTagCount = (stageKey: string, tagLabel: string) => {
      const m = tagStageCounts.get(stageKey) ?? new Map<string, number>();
      m.set(tagLabel, (m.get(tagLabel) ?? 0) + 1);
      tagStageCounts.set(stageKey, m);
    };

    for (const t of doneParents) {
      if (TAG_DRIVEN_STAGES.has(t.stage_current)) {
        addTagCount(stageLabel(t.stage_current), t.tags?.[0] ? tagDisplay(t.tags[0]) : NO_TAG_LABEL);
      } else {
        const label = baseGroupLabel(t, periodicLabels);
        simpleCounts.set(label, (simpleCounts.get(label) ?? 0) + 1);
      }
    }

    for (const c of relevantChildren) {
      const parent = parentById.get(c.parent_task_id!);
      // Só conta subtarefa se a tarefa mãe for de um estágio com etiqueta (design/vídeo) —
      // subtarefas de outros estágios (ex.: revisão) não entram nessa distribuição por tipo.
      if (!parent || !TAG_DRIVEN_STAGES.has(parent.stage_current)) continue;
      addTagCount(stageLabel(parent.stage_current), c.tags?.[0] ? tagDisplay(c.tags[0]) : NO_TAG_LABEL);
    }

    const buckets: Bucket[] = [];
    for (const [label, count] of simpleCounts) buckets.push({ label, count });
    for (const [label, tagCounts] of tagStageCounts) {
      const subBreakdown = Array.from(tagCounts.entries())
        .map(([l, c]) => ({ label: l, count: c }))
        .sort((a, b) => b.count - a.count);
      const total = subBreakdown.reduce((s, x) => s + x.count, 0);
      buckets.push({ label, count: total, subBreakdown });
    }
    return buckets.sort((a, b) => b.count - a.count);
  }, [tasks, childrenQ.data, periodicLabels]);

  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));

  const toggle = (label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="px-4 pb-4 pt-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        Distribuição do que você entregou em {format(month, "MMMM yyyy", { locale: ptBR })}, por tipo.
      </p>

      {breakdown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma entrega concluída neste mês.</p>
      ) : (
        <div className="space-y-2.5">
          {breakdown.map((b) => {
            const hasSub = !!b.subBreakdown && b.subBreakdown.length > 0;
            const isOpen = expanded.has(b.label);
            return (
              <div key={b.label}>
                <button
                  type="button"
                  disabled={!hasSub}
                  onClick={() => toggle(b.label)}
                  className="flex w-full items-center gap-2 text-left disabled:cursor-default"
                >
                  {hasSub ? (
                    isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <span className="w-24 shrink-0 truncate text-sm text-foreground" title={b.label}>{b.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[hsl(263_70%_55%)]"
                      style={{ width: `${Math.max(6, (b.count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span className="w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{b.count}</span>
                </button>

                {hasSub && isOpen && (
                  <div className="ml-[22px] mt-1.5 space-y-1.5 border-l border-border pl-3">
                    {b.subBreakdown!.map((s) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 truncate text-xs text-muted-foreground" title={s.label}>{s.label}</span>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-[hsl(263_70%_55%)]/60"
                            style={{ width: `${Math.max(6, (s.count / b.count) * 100)}%` }}
                          />
                        </div>
                        <span className="w-4 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">{s.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
