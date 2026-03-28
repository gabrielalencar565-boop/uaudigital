import { useMemo } from "react";
import {
  Trophy, Clock, Target, Crosshair,
  Gem, ShieldCheck, FolderKanban, BookOpen,
  ChevronRight, TrendingUp, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */

interface TaskData {
  id: string;
  status: string;
  completed_at: string | null;
  due_date: string;
  stage: string;
  point_value?: number | null;
}

interface QualitativeScores {
  padrao_qualidade_uau: number;
  comprometimento: number;
  ambiente_organizado: number;
  aprendizado_continuo: number;
}

interface Props {
  myTasks: TaskData[];
  teamAvgScore: number | null;
  myScore: number;
  todayKey: string;
  rank: number | null;
  rankTotal: number | null;
  qualitative: QualitativeScores | null;
  prevMonthDone: number;
  prevRank: number | null;
  prevRankTotal: number | null;
  prevQualitative: QualitativeScores | null;
  prevTasks: TaskData[];
}

/* ── Constants ── */

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface CriterionDef {
  key: keyof QualitativeScores;
  label: string;
  icon: React.ReactNode;
}

const CRITERIA: CriterionDef[] = [
  { key: "padrao_qualidade_uau", label: "Qualidade", icon: <Gem className="h-3.5 w-3.5" /> },
  { key: "comprometimento", label: "Responsabilidade", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { key: "ambiente_organizado", label: "Organização", icon: <FolderKanban className="h-3.5 w-3.5" /> },
  { key: "aprendizado_continuo", label: "Aprendizado", icon: <BookOpen className="h-3.5 w-3.5" /> },
];

function getShortFeedback(key: string, score: number): string {
  const map: Record<string, Record<number, string>> = {
    padrao_qualidade_uau: { 4: "Qualidade excelente", 3: "Qualidade pode evoluir", 2: "Qualidade precisa melhorar", 1: "Qualidade comprometida" },
    comprometimento: { 4: "Comprometimento exemplar", 3: "Comprometimento pode ser mais constante", 2: "Comprometimento precisa de atenção", 1: "Falta de comprometimento" },
    ambiente_organizado: { 4: "Organização impecável", 3: "Organização pode evoluir", 2: "Organização precisa melhorar", 1: "Desorganização prejudicando entregas" },
    aprendizado_continuo: { 4: "Evolução contínua", 3: "Progresso pode acelerar", 2: "Precisa investir em aprendizado", 1: "Estagnação no aprendizado" },
  };
  const m = map[key];
  if (!m) return "";
  if (score >= 4) return m[4]!;
  if (score >= 3) return m[3]!;
  if (score >= 2) return m[2]!;
  if (score >= 1) return m[1]!;
  return "Sem avaliação";
}

/* ── Component ── */

export function SmartFeedbackWidget({
  myTasks, teamAvgScore, myScore, todayKey,
  rank, rankTotal, qualitative,
  prevMonthDone, prevRank, prevRankTotal, prevQualitative, prevTasks,
}: Props) {

  /* ── Dynamic months ── */
  const now = new Date();
  const curMonth = MONTH_NAMES[now.getMonth()];
  const prevMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevMonth = MONTH_NAMES[prevMonthIdx];

  /* ── Current month stats ── */
  const total = myTasks.length;
  const done = myTasks.filter((t) => t.status === "concluido").length;
  const doneOnTime = myTasks.filter((t) => {
    if (t.status !== "concluido" || !t.completed_at) return false;
    return t.completed_at.slice(0, 10) <= t.due_date;
  }).length;
  const pctOnTime = done > 0 ? Math.round((doneOnTime / done) * 100) : 100;

  const nota = useMemo(() => {
    if (total === 0) return 0;
    const raw = (done / total) * 5 + (done > 0 ? doneOnTime / done : 1) * 5;
    return Math.round(raw * 10) / 10;
  }, [total, done, doneOnTime]);

  /* ── Previous month stats ── */
  const prevTotal = prevTasks.length;
  const prevDone = prevTasks.filter((t) => t.status === "concluido").length;
  const prevDoneOnTime = prevTasks.filter((t) => {
    if (t.status !== "concluido" || !t.completed_at) return false;
    return t.completed_at.slice(0, 10) <= t.due_date;
  }).length;
  const prevPctOnTime = prevDone > 0 ? Math.round((prevDoneOnTime / prevDone) * 100) : 100;

  const prevNota = useMemo(() => {
    if (prevTotal === 0) return 0;
    const raw = (prevDone / prevTotal) * 5 + (prevDone > 0 ? prevDoneOnTime / prevDone : 1) * 5;
    return Math.round(raw * 10) / 10;
  }, [prevTotal, prevDone, prevDoneOnTime]);

  /* ── Critical point (worst area) ── */
  const criticalPoint = useMemo(() => {
    if (prevQualitative) {
      const worst = [...CRITERIA].sort((a, b) => (prevQualitative[a.key] ?? 0) - (prevQualitative[b.key] ?? 0))[0];
      if (worst && (prevQualitative[worst.key] ?? 0) <= 2) return worst.label;
    }
    if (prevPctOnTime < 70 && prevTotal > 0) return "Pontualidade";
    if (prevRank && prevRank > 5) return "Ranking";
    return null;
  }, [prevQualitative, prevPctOnTime, prevTotal, prevRank]);

  /* ── Best strength (1 only) ── */
  const bestStrength = useMemo(() => {
    if (prevPctOnTime >= 90 && prevTotal > 0) return { icon: <Clock className="h-3.5 w-3.5" />, text: "Boa pontualidade" };
    if (prevRank && prevRank <= 3) return { icon: <Trophy className="h-3.5 w-3.5" />, text: `Top ${prevRank} no ranking` };
    if (prevQualitative) {
      const best = [...CRITERIA].sort((a, b) => (prevQualitative[b.key] ?? 0) - (prevQualitative[a.key] ?? 0))[0];
      if (best && (prevQualitative[best.key] ?? 0) >= 3) return { icon: best.icon, text: getShortFeedback(best.key, prevQualitative[best.key]) };
    }
    if (prevTotal > 0) return { icon: <TrendingUp className="h-3.5 w-3.5" />, text: "Entregas consistentes" };
    return null;
  }, [prevPctOnTime, prevTotal, prevRank, prevQualitative]);

  /* ── Weaknesses (max 2) ── */
  const weaknesses = useMemo(() => {
    const list: { icon: React.ReactNode; text: string }[] = [];
    if (prevPctOnTime < 80 && prevTotal > 0) list.push({ icon: <Clock className="h-3.5 w-3.5" />, text: "Entregas fora do prazo" });
    if (prevRank && prevRank > 3) list.push({ icon: <Trophy className="h-3.5 w-3.5" />, text: "Ranking pode melhorar" });
    if (prevQualitative) {
      const sorted = [...CRITERIA].sort((a, b) => (prevQualitative[a.key] ?? 0) - (prevQualitative[b.key] ?? 0));
      for (const c of sorted) {
        if ((prevQualitative[c.key] ?? 0) <= 2 && list.length < 2) {
          list.push({ icon: c.icon, text: getShortFeedback(c.key, prevQualitative[c.key] ?? 0) });
        }
      }
    }
    return list.slice(0, 2);
  }, [prevPctOnTime, prevTotal, prevRank, prevQualitative]);

  /* ── Direction tips (2-3) ── */
  const directionTips = useMemo(() => {
    const list: string[] = [];
    if (prevPctOnTime < 80 && prevTotal > 0) list.push("Aumentar pontualidade nas entregas");
    if (prevRank && prevRank > 3) list.push("Subir no ranking com mais volume");
    if (prevQualitative) {
      const sorted = [...CRITERIA].sort((a, b) => (prevQualitative[a.key] ?? 0) - (prevQualitative[b.key] ?? 0));
      for (const c of sorted) {
        if ((prevQualitative[c.key] ?? 0) <= 2 && list.length < 3) {
          list.push(`Melhorar ${c.label.toLowerCase()}`);
        }
      }
    }
    if (list.length === 0 && total > 0) list.push("Manter o ritmo de entregas");
    return list.slice(0, 3);
  }, [prevPctOnTime, prevTotal, prevRank, prevQualitative, total]);

  /* ── Focus goal ── */
  const focusGoal = useMemo(() => {
    if (prevQualitative) {
      const worst = [...CRITERIA].sort((a, b) => (prevQualitative[a.key] ?? 0) - (prevQualitative[b.key] ?? 0))[0];
      if (worst && (prevQualitative[worst.key] ?? 0) <= 2) {
        return `Melhorar ${worst.label.toLowerCase()} para subir no ranking`;
      }
    }
    if (prevPctOnTime < 70 && prevTotal > 0) return "Recuperar pontualidade nas entregas";
    if (prevRank && prevRank > 5) return "Subir no ranking com mais volume e consistência";
    return "Manter o alto padrão de desempenho";
  }, [prevQualitative, prevPctOnTime, prevTotal, prevRank]);

  const notaColor = nota >= 8 ? "text-emerald-500" : nota >= 6 ? "text-amber-500" : "text-red-500";
  const hasPrevData = prevTotal > 0 || prevQualitative !== null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 transition-all duration-300 hover:shadow-md">

      {/* ── TOPO: Resumo compacto ── */}
      <div
        className="flex items-center justify-between gap-3 opacity-0"
        style={{ animation: "fadeUp 0.4s ease-out forwards" }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-sidebar shrink-0" />
            <h3 className="text-sm font-bold text-foreground tracking-tight truncate">
              Desempenho em {prevMonth}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              Nota: <span className={cn("font-bold", notaColor)}>{nota.toFixed(1)}</span>
            </span>
            {prevRank !== null && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-xs text-muted-foreground">
                  Ranking: <span className={cn("font-bold", prevRank <= 3 ? "text-emerald-500" : "text-foreground")}>{prevRank}º</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Badge nota */}
        <div className={cn(
          "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold shrink-0",
          nota >= 8 ? "bg-emerald-500/10 text-emerald-500" : nota >= 6 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500",
        )}>
          {nota >= 8 ? "🏆" : nota >= 6 ? "🚀" : "⚠️"} {nota.toFixed(1)}
        </div>
      </div>

      {/* Critical point subtitle */}
      {criticalPoint && (
        <p className="text-[11px] text-muted-foreground/60 -mt-1 ml-5.5 opacity-0" style={{ animation: "fadeUp 0.3s ease-out 0.1s forwards" }}>
          Principal melhoria: <span className="text-amber-500 font-medium">{criticalPoint}</span>
        </p>
      )}

      {/* ── FEEDBACKS RÁPIDOS ── */}
      {hasPrevData && (
        <div className="space-y-1 opacity-0" style={{ animation: "fadeUp 0.4s ease-out 0.15s forwards" }}>
          {bestStrength && (
            <div className="flex items-center gap-2 py-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-xs text-foreground/80">{bestStrength.text}</span>
            </div>
          )}
          {weaknesses.map((w, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-xs text-foreground/80">{w.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      {hasPrevData && <div className="border-t border-border/20" />}

      {/* ── DIRECIONAMENTO MÊS ATUAL ── */}
      <div className="space-y-1.5 opacity-0" style={{ animation: "fadeUp 0.4s ease-out 0.25s forwards" }}>
        <div className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-muted-foreground/50" />
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
            Para melhorar em {curMonth}
          </p>
        </div>

        {directionTips.map((tip, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <ChevronRight className="h-3 w-3 text-sidebar shrink-0" />
            <span className="text-xs text-foreground/80">{tip}</span>
          </div>
        ))}
      </div>

      {/* ── FOCO DO MÊS ── */}
      <div
        className="flex items-center gap-2.5 py-2 px-3 rounded-xl bg-sidebar/5 border border-sidebar/10 opacity-0"
        style={{ animation: "fadeUp 0.4s ease-out 0.35s forwards" }}
      >
        <Crosshair className="h-4 w-4 text-sidebar shrink-0" />
        <div className="min-w-0">
          <span className="text-[9px] font-semibold text-sidebar/50 uppercase tracking-widest">Foco do mês</span>
          <p className="text-xs font-semibold text-sidebar leading-tight">{focusGoal}</p>
        </div>
      </div>

      {/* ── Empty state ── */}
      {total === 0 && !hasPrevData && (
        <p className="text-xs text-muted-foreground/50 text-center py-2">Sem dados suficientes.</p>
      )}
    </div>
  );
}
