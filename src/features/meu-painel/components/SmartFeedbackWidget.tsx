import { useMemo, useState } from "react";
import {
  Trophy, Target, Crosshair,
  Gem, ShieldCheck, FolderKanban, BookOpen,
  ChevronRight, AlertTriangle, CheckCircle2, Zap,
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
  { key: "padrao_qualidade_uau", label: "Qualidade", maxScore: 4, weight: "alto", icon: <Gem className="h-4 w-4" /> },
  { key: "comprometimento", label: "Responsabilidade", maxScore: 4, weight: "alto", icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "ambiente_organizado", label: "Organização", maxScore: 3, weight: "medio", icon: <FolderKanban className="h-4 w-4" /> },
  { key: "aprendizado_continuo", label: "Aprendizado", maxScore: 3, weight: "medio", icon: <BookOpen className="h-4 w-4" /> },
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

function getDiagnosis(rank: number | null, rankTotal: number | null): { label: string; color: string; bg: string } {
  if (rank === null) return { label: "Sem dados", color: "text-muted-foreground", bg: "bg-muted/30" };
  const pct = rankTotal && rankTotal > 0 ? rank / rankTotal : 1;
  if (pct <= 0.25) return { label: "Excelente", color: "text-emerald-500", bg: "bg-emerald-500/10" };
  if (pct <= 0.5) return { label: "Bom", color: "text-sky-500", bg: "bg-sky-500/10" };
  if (pct <= 0.75) return { label: "Regular", color: "text-amber-500", bg: "bg-amber-500/10" };
  return { label: "Alerta", color: "text-red-500", bg: "bg-red-500/10" };
}

const LEVEL_STYLES: Record<Level, { bg: string; border: string; text: string; bar: string }> = {
  alto: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-500", bar: "bg-emerald-500" },
  medio: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-500", bar: "bg-amber-500" },
  baixo: { bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-500", bar: "bg-red-500" },
};

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
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg">

      {/* ── HEADER with gradient ── */}
      <div className="relative px-4 pt-4 pb-3" style={{ background: "linear-gradient(135deg, hsl(263 70% 50% / 0.08), transparent 70%)" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-sidebar/15 flex items-center justify-center shadow-sm">
              <Trophy className="h-4.5 w-4.5 text-sidebar" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight">
                🏆 Desempenho em {analysisLabel}
              </h3>
            </div>
          </div>
          {/* Toggle */}
          <div className="flex rounded-lg overflow-hidden text-xs border border-border bg-background/50">
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
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* ── STATUS CARD ── */}
        <div className={cn(
          "rounded-xl border p-3 flex items-center justify-between transition-all duration-300",
          diagnosis.bg, diagnosis.color === "text-red-500" ? "border-red-500/20" : diagnosis.color === "text-amber-500" ? "border-amber-500/20" : diagnosis.color === "text-emerald-500" ? "border-emerald-500/20" : "border-sky-500/20",
        )} style={diagnosis.color === "text-red-500" ? { boxShadow: "0 0 20px -5px rgba(239,68,68,0.15)" } : diagnosis.color === "text-emerald-500" ? { boxShadow: "0 0 20px -5px rgba(16,185,129,0.15)" } : undefined}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0",
              diagnosis.bg,
            )}>
              {analysisRank !== null ? (analysisRank <= 1 ? "🏆" : analysisRank <= 3 ? "🚀" : "⚠️") : "📊"}
            </div>
            <div>
              <span className={cn("text-sm font-bold", diagnosis.color)}>{diagnosis.label}</span>
              <div className="flex items-center gap-2 mt-0.5">
                {analysisRank !== null && (
                  <span className="text-xs text-muted-foreground">
                    Ranking: <span className="font-bold text-foreground">{analysisRank}º</span>
                    {analysisRankTotal ? <span className="text-muted-foreground/50"> de {analysisRankTotal}</span> : null}
                  </span>
                )}
                {analysisScore > 0 && (
                  <>
                    {analysisRank !== null && <span className="text-muted-foreground/30">•</span>}
                    <span className="text-xs text-muted-foreground">
                      Pontos: <span className="font-bold text-foreground">{isAnnual ? analysisScore.toFixed(1) : analysisScore}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── CRITERIA GRID (2x2 cards) ── */}
        {hasData && (
          <div className="grid grid-cols-2 gap-2">
            {scoredCriteria.map((c) => {
              const pct = Math.round((c.score / c.maxScore) * 100);
              const styles = LEVEL_STYLES[c.level];
              return (
                <div
                  key={c.key}
                  className={cn(
                    "rounded-xl border p-2.5 transition-all duration-200 hover:scale-[1.02]",
                    styles.bg, styles.border,
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn("shrink-0", styles.text)}>{c.icon}</span>
                    <span className={cn("text-base font-bold tabular-nums", styles.text)}>
                      {isAnnual ? c.score.toFixed(1) : c.score}<span className="text-xs font-normal text-muted-foreground">/{c.maxScore}</span>
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-foreground/80 mb-1.5 leading-tight">{c.label}</p>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700 ease-out", styles.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PROBLEMS ── */}
        {hasData && problems.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Principais problemas</p>
            {problems.map((p, i) => {
              const styles = LEVEL_STYLES[p.level];
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border p-2.5 flex items-start gap-2.5 transition-all duration-200 hover:scale-[1.01]",
                    styles.bg, styles.border,
                  )}
                >
                  <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", p.level === "baixo" ? "bg-red-500/15" : "bg-amber-500/15")}>
                    <AlertTriangle className={cn("h-3.5 w-3.5", styles.text)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={cn("text-xs font-bold", styles.text)}>{p.label}</span>
                    <p className="text-[11px] text-foreground/60 leading-tight">{FEEDBACK_MAP[p.key]?.[p.level] ?? ""}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── STRENGTH ── */}
        {hasData && bestStrength && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 flex items-start gap-2.5 transition-all duration-200 hover:scale-[1.01]">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-emerald-500">Ponto forte: {bestStrength.label}</span>
              <p className="text-[11px] text-foreground/60 leading-tight">{FEEDBACK_MAP[bestStrength.key]?.[bestStrength.level] ?? ""}</p>
            </div>
          </div>
        )}

        {/* ── ACTIONS ── */}
        {actions.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-sidebar" />
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Ações</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {actions.map((a, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-muted/30 border border-border/50 transition-all duration-200 hover:bg-muted/50 hover:scale-[1.01]">
                  <ChevronRight className="h-3.5 w-3.5 text-sidebar shrink-0" />
                  <span className="text-[11px] font-medium text-foreground/80">{a}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FOCUS CARD (premium) ── */}
        <div
          className="relative rounded-xl p-3 flex items-center gap-3 overflow-hidden transition-all duration-200 hover:scale-[1.01]"
          style={{
            background: "linear-gradient(135deg, hsl(263 70% 50% / 0.12), hsl(263 70% 50% / 0.04))",
            border: "1px solid hsl(263 70% 50% / 0.2)",
            boxShadow: "0 0 24px -8px hsl(263 70% 50% / 0.15)",
          }}
        >
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsl(263 70% 50% / 0.15)" }}>
            <Crosshair className="h-4 w-4 text-sidebar" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-bold text-sidebar/60 uppercase tracking-widest">
              {isAnnual ? "Foco do ano" : "Foco do mês"}
            </span>
            <p className="text-xs font-semibold text-sidebar leading-tight">{focusGoal}</p>
          </div>
          <Target className="h-16 w-16 text-sidebar/5 absolute -right-2 -bottom-2" />
        </div>

        {/* ── Empty ── */}
        {!hasData && analysisScore === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-4">Sem dados de avaliação qualitativa.</p>
        )}
      </div>
    </div>
  );
}
