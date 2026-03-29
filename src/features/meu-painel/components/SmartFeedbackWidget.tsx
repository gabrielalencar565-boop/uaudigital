import { useMemo, useState } from "react";
import {
  Trophy, Target, Crosshair,
  Gem, ShieldCheck, FolderKanban, BookOpen,
  ChevronRight, AlertTriangle, CheckCircle2,
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
  annualQualitative: QualitativeScores | null;
  annualScore: number;
  annualRank: number | null;
  annualRankTotal: number | null;
}

/* ── Constants ── */

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface CriterionDef {
  key: keyof QualitativeScores;
  label: string;
  maxScore: number;
  weight: "alto" | "medio";
  icon: React.ReactNode;
}

const CRITERIA: CriterionDef[] = [
  { key: "padrao_qualidade_uau", label: "Qualidade", maxScore: 4, weight: "alto", icon: <Gem className="h-3.5 w-3.5" /> },
  { key: "comprometimento", label: "Responsabilidade", maxScore: 4, weight: "alto", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { key: "ambiente_organizado", label: "Organização", maxScore: 3, weight: "medio", icon: <FolderKanban className="h-3.5 w-3.5" /> },
  { key: "aprendizado_continuo", label: "Aprendizado", maxScore: 3, weight: "medio", icon: <BookOpen className="h-3.5 w-3.5" /> },
];

type Level = "alto" | "medio" | "baixo";

function getLevel(score: number, maxScore: number): Level {
  if (maxScore === 4) {
    if (score >= 3) return "alto";
    if (score >= 2) return "medio";
    return "baixo";
  }
  if (score >= 3) return "alto";
  if (score >= 2) return "medio";
  return "baixo";
}

const FEEDBACK_MAP: Record<string, Record<Level, string>> = {
  padrao_qualidade_uau: {
    alto: "Qualidade consistente, com baixo retrabalho",
    medio: "Qualidade boa, mas ainda com ajustes frequentes",
    baixo: "A qualidade está comprometendo as entregas",
  },
  comprometimento: {
    alto: "Você mantém boa confiabilidade nas entregas",
    medio: "Comprometimento razoável, mas com oscilações",
    baixo: "Falta de comprometimento impactando resultados",
  },
  ambiente_organizado: {
    alto: "Organização exemplar no fluxo de trabalho",
    medio: "Organização razoável, mas pode melhorar",
    baixo: "Desorganização comprometendo sua produtividade",
  },
  aprendizado_continuo: {
    alto: "Evolução contínua e proativa",
    medio: "Progresso presente, mas pode acelerar",
    baixo: "Estagnação no aprendizado técnico",
  },
};

const ACTION_MAP: Record<string, string> = {
  padrao_qualidade_uau: "Melhore a qualidade para reduzir retrabalho",
  comprometimento: "Aumente a consistência nas entregas e prazos",
  ambiente_organizado: "Organize melhor suas tarefas antes da execução",
  aprendizado_continuo: "Invista em aprendizado para evoluir tecnicamente",
};

const FOCUS_MAP: Record<string, string> = {
  padrao_qualidade_uau: "Melhorar qualidade para evitar impacto nas entregas",
  comprometimento: "Aumentar comprometimento para subir no ranking",
  ambiente_organizado: "Organizar fluxo de trabalho para ganhar produtividade",
  aprendizado_continuo: "Investir em aprendizado para crescimento técnico",
};

function getDiagnosis(rank: number | null, rankTotal: number | null): { label: string; color: string } {
  if (rank === null) return { label: "Sem dados", color: "text-muted-foreground" };
  const pct = rankTotal && rankTotal > 0 ? rank / rankTotal : 1;
  if (pct <= 0.25) return { label: "Excelente", color: "text-emerald-500" };
  if (pct <= 0.5) return { label: "Bom", color: "text-sky-500" };
  if (pct <= 0.75) return { label: "Regular", color: "text-amber-500" };
  return { label: "Alerta", color: "text-red-500" };
}

type ViewMode = "mes" | "anual";

/* ── Component ── */

export function SmartFeedbackWidget({
  myScore, qualitative,
  rank, rankTotal,
  prevRank, prevRankTotal, prevQualitative,
  annualQualitative, annualScore, annualRank, annualRankTotal,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("mes");
  const now = new Date();
  const curMonth = MONTH_NAMES[now.getMonth()];
  const prevMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevMonth = MONTH_NAMES[prevMonthIdx];

  // Pick data based on view mode
  const isAnnual = viewMode === "anual";

  const analysisQ = isAnnual ? annualQualitative : (prevQualitative ?? qualitative);
  const analysisRank = isAnnual ? annualRank : (prevRank ?? rank);
  const analysisRankTotal = isAnnual ? annualRankTotal : (prevRankTotal ?? rankTotal);
  const analysisScore = isAnnual ? annualScore : myScore;
  const analysisLabel = isAnnual ? `${now.getFullYear()}` : (prevQualitative ? prevMonth : curMonth);

  const diagnosis = getDiagnosis(analysisRank, analysisRankTotal);

  const scoredCriteria = useMemo(() => {
    if (!analysisQ) return [];
    return CRITERIA.map((c) => {
      const score = analysisQ[c.key] ?? 0;
      const level = getLevel(score, c.maxScore);
      return { ...c, score, level };
    });
  }, [analysisQ]);

  const bestStrength = useMemo(() => {
    const highLevel = scoredCriteria
      .filter((c) => c.level === "alto")
      .sort((a, b) => (a.weight === "alto" ? -1 : 1) - (b.weight === "alto" ? -1 : 1));
    if (highLevel.length > 0) return highLevel[0];
    const medLevel = scoredCriteria.filter((c) => c.level === "medio").sort((a, b) => b.score - a.score);
    return medLevel[0] ?? null;
  }, [scoredCriteria]);

  const problems = useMemo(() => {
    const low = scoredCriteria.filter((c) => c.level === "baixo" || c.level === "medio");
    low.sort((a, b) => {
      if (a.key === "padrao_qualidade_uau" && a.level !== "alto") return -1;
      if (b.key === "padrao_qualidade_uau" && b.level !== "alto") return 1;
      if (a.key === "comprometimento" && a.level !== "alto") return -1;
      if (b.key === "comprometimento" && b.level !== "alto") return 1;
      return a.score - b.score;
    });
    const result = low.filter((c) => c.level === "baixo");
    if (result.length < 2) {
      const medProblems = low.filter((c) => c.level === "medio" && !result.includes(c));
      result.push(...medProblems);
    }
    return result.filter((c) => !bestStrength || c.key !== bestStrength.key).slice(0, 2);
  }, [scoredCriteria, bestStrength]);

  const actions = useMemo(() => {
    return problems.map((p) => ACTION_MAP[p.key]).filter(Boolean).slice(0, 2);
  }, [problems]);

  const focusGoal = useMemo(() => {
    if (scoredCriteria.length === 0) return "Manter o alto padrão de desempenho";
    const worst = [...scoredCriteria].sort((a, b) => a.score - b.score)[0];
    if (worst && worst.level !== "alto") return FOCUS_MAP[worst.key] ?? "Manter o ritmo de entregas";
    return "Manter o alto padrão de desempenho";
  }, [scoredCriteria]);

  const hasData = analysisQ !== null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 transition-all duration-300 hover:shadow-lg">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="h-7 w-7 rounded-lg bg-sidebar/20 flex items-center justify-center">
              <Trophy className="h-4 w-4 text-sidebar" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Seu desempenho</h3>
              <p className="text-[11px] text-muted-foreground">
                {isAnnual ? `Média anual ${now.getFullYear()}` : `Diagnóstico de ${analysisLabel}`}
              </p>
            </div>
          </div>
        </div>
        {/* Toggle */}
        <div className="flex rounded-lg overflow-hidden text-xs border border-border">
          <button
            onClick={() => setViewMode("mes")}
            className={cn(
              "px-3 py-1.5 font-medium transition-all duration-200",
              viewMode === "mes" ? "bg-sidebar text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Mês
          </button>
          <button
            onClick={() => setViewMode("anual")}
            className={cn(
              "px-3 py-1.5 font-medium transition-all duration-200",
              viewMode === "anual" ? "bg-sidebar text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Anual
          </button>
        </div>
      </div>

      {/* ── RANKING + DIAGNOSIS LINE ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {analysisRank !== null && (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold",
            analysisRank <= 3 ? "bg-emerald-500/10 text-emerald-500"
              : analysisRank <= 5 ? "bg-amber-500/10 text-amber-500"
              : "bg-red-500/10 text-red-500",
          )}>
            {analysisRank <= 1 ? "🏆" : analysisRank <= 3 ? "🚀" : "⚠️"} {analysisRank}º
            {analysisRankTotal ? <span className="font-normal text-muted-foreground">/{analysisRankTotal}</span> : null}
          </span>
        )}
        <span className={cn("text-xs font-semibold", diagnosis.color)}>
          {diagnosis.label}
        </span>
        {analysisScore > 0 && (
          <>
            <span className="text-muted-foreground/30">•</span>
            <span className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{isAnnual ? analysisScore.toFixed(1) : analysisScore}</span> {isAnnual ? "pts/mês" : "pts"}
            </span>
          </>
        )}
      </div>

      {/* ── CRITERIA BARS ── */}
      {hasData && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {scoredCriteria.map((c) => {
            const pct = Math.round((c.score / c.maxScore) * 100);
            const barColor = c.level === "alto"
              ? "bg-emerald-500"
              : c.level === "medio"
              ? "bg-amber-500"
              : "bg-red-500";
            return (
              <div key={c.key} className="flex items-center gap-2">
                <span className={cn(
                  "shrink-0",
                  c.level === "alto" ? "text-emerald-500" : c.level === "medio" ? "text-amber-500" : "text-red-500",
                )}>
                  {c.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-muted-foreground truncate">{c.label}</span>
                    <span className="text-[11px] font-bold text-foreground tabular-nums">
                      {isAnnual ? c.score.toFixed(1) : c.score}/{c.maxScore}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasData && <div className="border-t border-border/30" />}

      {/* ── STRENGTH + PROBLEMS ── */}
      {hasData && (
        <div className="space-y-1">
          {bestStrength && (
            <div className="flex items-start gap-2 py-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-emerald-500">{bestStrength.label}</span>
                <p className="text-[11px] text-foreground/70 leading-tight">{FEEDBACK_MAP[bestStrength.key]?.[bestStrength.level] ?? ""}</p>
              </div>
            </div>
          )}
          {problems.map((p, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", p.level === "baixo" ? "text-red-500" : "text-amber-500")} />
              <div className="min-w-0">
                <span className={cn("text-[11px] font-bold", p.level === "baixo" ? "text-red-500" : "text-amber-500")}>{p.label}</span>
                <p className="text-[11px] text-foreground/70 leading-tight">{FEEDBACK_MAP[p.key]?.[p.level] ?? ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ACTIONS ── */}
      {actions.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Target className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Ações</span>
          </div>
          {actions.map((a, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <ChevronRight className="h-3 w-3 text-sidebar shrink-0" />
              <span className="text-[11px] text-foreground/80">{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── FOCUS ── */}
      <div className="flex items-center gap-2.5 py-2 px-3 rounded-xl bg-sidebar/5 border border-sidebar/10">
        <Crosshair className="h-4 w-4 text-sidebar shrink-0" />
        <div className="min-w-0">
          <span className="text-[9px] font-semibold text-sidebar/50 uppercase tracking-widest">
            {isAnnual ? "Foco do ano" : "Foco do mês"}
          </span>
          <p className="text-[11px] font-semibold text-sidebar leading-tight">{focusGoal}</p>
        </div>
      </div>

      {/* ── Empty ── */}
      {!hasData && analysisScore === 0 && (
        <p className="text-xs text-muted-foreground/50 text-center py-2">Sem dados de avaliação qualitativa.</p>
      )}
    </div>
  );
}
