import { useMemo } from "react";
import {
  Sparkles, Trophy, Clock, Target, Crosshair,
  Gem, ShieldCheck, FolderKanban, BookOpen,
  AlertCircle, ArrowUpRight, ChevronRight, Calendar,
  TrendingUp, Award,
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
  /* Current month */
  myTasks: TaskData[];
  teamAvgScore: number | null;
  myScore: number;
  todayKey: string;
  rank: number | null;
  rankTotal: number | null;
  qualitative: QualitativeScores | null;
  /* Previous month */
  prevMonthDone: number;
  prevRank: number | null;
  prevRankTotal: number | null;
  prevQualitative: QualitativeScores | null;
  prevTasks: TaskData[];
}

/* ── Feedback helpers ── */

interface CriterionDef {
  key: keyof QualitativeScores;
  label: string;
  icon: React.ReactNode;
}

const CRITERIA: CriterionDef[] = [
  { key: "padrao_qualidade_uau", label: "Qualidade", icon: <Gem className="h-4 w-4" /> },
  { key: "comprometimento", label: "Responsabilidade", icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "ambiente_organizado", label: "Organização", icon: <FolderKanban className="h-4 w-4" /> },
  { key: "aprendizado_continuo", label: "Aprendizado", icon: <BookOpen className="h-4 w-4" /> },
];

function getFeedbackText(key: string, score: number): string {
  const map: Record<string, Record<number, string>> = {
    padrao_qualidade_uau: {
      4: "Qualidade excelente, padrão de referência",
      3: "Boa qualidade, pode evoluir em consistência",
      2: "Qualidade precisa melhorar para evitar retrabalho",
      1: "Qualidade comprometendo as entregas",
    },
    comprometimento: {
      4: "Comprometimento exemplar",
      3: "Bom comprometimento, pode ser mais constante",
      2: "Comprometimento precisa de mais atenção",
      1: "Falta de comprometimento impactando resultados",
    },
    ambiente_organizado: {
      4: "Organização impecável, referência para o time",
      3: "Boa organização, há espaço para evoluir",
      2: "Organização precisa melhorar",
      1: "Desorganização prejudicando entregas",
    },
    aprendizado_continuo: {
      4: "Excelente evolução contínua",
      3: "Bom progresso, pode buscar mais",
      2: "Precisa investir mais em aprendizado",
      1: "Estagnação no aprendizado",
    },
  };
  const m = map[key];
  if (!m) return "";
  if (score >= 4) return m[4]!;
  if (score >= 3) return m[3]!;
  if (score >= 2) return m[2]!;
  if (score >= 1) return m[1]!;
  return "Sem avaliação";
}

function feedbackColor(score: number): "green" | "yellow" | "red" | "muted" {
  if (score >= 4) return "green";
  if (score >= 3) return "yellow";
  if (score >= 1) return "red";
  return "muted";
}

const DOT_BG: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
  muted: "bg-muted-foreground/30",
};

const ICON_FG: Record<string, string> = {
  green: "text-emerald-500",
  yellow: "text-amber-500",
  red: "text-red-500",
  muted: "text-muted-foreground/40",
};

/* ── Component ── */

export function SmartFeedbackWidget({
  myTasks, teamAvgScore, myScore, todayKey,
  rank, rankTotal, qualitative,
  prevMonthDone, prevRank, prevRankTotal, prevQualitative, prevTasks,
}: Props) {

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

  /* ── Previous month: strengths & weaknesses ── */
  const prevStrengths = useMemo(() => {
    const list: { icon: React.ReactNode; text: string }[] = [];
    if (prevPctOnTime >= 80 && prevTotal > 0) list.push({ icon: <Clock className="h-3.5 w-3.5" />, text: "Boa pontualidade nas entregas" });
    if (prevRank && prevRank <= 3) list.push({ icon: <Trophy className="h-3.5 w-3.5" />, text: `Top ${prevRank} no ranking` });
    if (prevQualitative) {
      for (const c of CRITERIA) {
        if ((prevQualitative[c.key] ?? 0) >= 4 && list.length < 3) {
          list.push({ icon: c.icon, text: getFeedbackText(c.key, 4) });
        }
      }
      if (list.length < 2) {
        for (const c of CRITERIA) {
          if ((prevQualitative[c.key] ?? 0) >= 3 && list.length < 3) {
            list.push({ icon: c.icon, text: getFeedbackText(c.key, 3) });
          }
        }
      }
    }
    if (list.length === 0 && prevTotal > 0) list.push({ icon: <TrendingUp className="h-3.5 w-3.5" />, text: "Manteve entregas consistentes" });
    return list.slice(0, 3);
  }, [prevPctOnTime, prevTotal, prevRank, prevQualitative]);

  const prevWeaknesses = useMemo(() => {
    const list: { icon: React.ReactNode; text: string }[] = [];
    if (prevPctOnTime < 80 && prevTotal > 0) list.push({ icon: <Clock className="h-3.5 w-3.5" />, text: "Entregas fora do prazo" });
    if (prevRank && prevRank > 3) list.push({ icon: <Trophy className="h-3.5 w-3.5" />, text: "Posição no ranking pode melhorar" });
    if (prevQualitative) {
      const sorted = [...CRITERIA].sort((a, b) => (prevQualitative[a.key] ?? 0) - (prevQualitative[b.key] ?? 0));
      for (const c of sorted) {
        if ((prevQualitative[c.key] ?? 0) <= 2 && list.length < 3) {
          list.push({ icon: c.icon, text: getFeedbackText(c.key, prevQualitative[c.key] ?? 0) });
        }
      }
    }
    return list.slice(0, 3);
  }, [prevPctOnTime, prevTotal, prevRank, prevQualitative]);

  /* ── Current month: direction tips ── */
  const directionTips = useMemo(() => {
    const list: string[] = [];

    // Based on previous month weaknesses
    if (prevPctOnTime < 80 && prevTotal > 0) list.push("Priorize entregar tarefas dentro do prazo este mês");
    if (prevRank && prevRank > 3) list.push("Aumente seu volume e pontualidade para subir no ranking");

    if (prevQualitative) {
      const sorted = [...CRITERIA].sort((a, b) => (prevQualitative[a.key] ?? 0) - (prevQualitative[b.key] ?? 0));
      for (const c of sorted) {
        if ((prevQualitative[c.key] ?? 0) <= 2 && list.length < 4) {
          list.push(`Foque em melhorar sua ${c.label.toLowerCase()} este mês`);
        }
      }
    }

    // Fallbacks based on current month
    if (list.length === 0 && pctOnTime < 80 && total > 0) list.push("Melhore sua consistência nas entregas dentro do prazo");
    if (list.length === 0 && total > 0) list.push("Continue mantendo o ritmo de entregas");

    return list.slice(0, 4);
  }, [prevPctOnTime, prevTotal, prevRank, prevQualitative, pctOnTime, total]);

  /* ── Focus goal ── */
  const focusGoal = useMemo(() => {
    if (prevQualitative) {
      const worst = [...CRITERIA].sort((a, b) => (prevQualitative[a.key] ?? 0) - (prevQualitative[b.key] ?? 0))[0];
      if (worst && (prevQualitative[worst.key] ?? 0) <= 2) {
        return `Evoluir ${worst.label.toLowerCase()} para evitar impactos nas entregas`;
      }
    }
    if (prevPctOnTime < 70 && prevTotal > 0) return "Recuperar pontualidade nas entregas";
    if (prevRank && prevRank > 5) return "Subir no ranking com mais volume e consistência";
    if (pctOnTime < 80 && total > 0) return "Manter todas as entregas dentro do prazo";
    return "Manter o alto padrão de desempenho";
  }, [prevQualitative, prevPctOnTime, prevTotal, prevRank, pctOnTime, total]);

  /* ── Headline ── */
  const headline = useMemo(() => {
    if (nota >= 9) return { text: "Desempenho excepcional", sub: "Você é referência para o time", emoji: "🏆" };
    if (nota >= 7) return { text: "Bom desempenho", sub: "Continue focado para manter o ritmo", emoji: "🚀" };
    if (nota >= 5) return { text: "Desempenho mediano", sub: "Há espaço claro para evoluir", emoji: "📋" };
    if (total > 0) return { text: "Atenção necessária", sub: "Reorganize suas prioridades", emoji: "⚠️" };
    return { text: "Sem dados", sub: "Nenhuma tarefa registrada neste mês", emoji: "📊" };
  }, [nota, total]);

  const notaColor = nota >= 8 ? "text-emerald-500" : nota >= 6 ? "text-amber-500" : "text-red-500";
  const notaBorder = nota >= 8 ? "border-emerald-500/20" : nota >= 6 ? "border-amber-500/20" : "border-red-500/20";
  const notaGlow = nota >= 8 ? "shadow-emerald-500/20" : nota >= 6 ? "shadow-amber-500/20" : "shadow-red-500/20";

  const hasPrevData = prevTotal > 0 || prevQualitative !== null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-5 transition-all duration-300 hover:shadow-lg">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-sidebar/20 to-sidebar/5 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-sidebar" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              {headline.emoji} {headline.text}
            </h3>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{headline.sub}</p>
          </div>
        </div>

        <div
          className={cn("flex flex-col items-center rounded-xl border px-3 py-1.5 shrink-0 shadow-sm", notaBorder, notaGlow)}
          style={{ animation: "fadeUp 0.6s ease-out forwards" }}
        >
          <span className={cn("text-2xl font-black tabular-nums tracking-tighter leading-none", notaColor)}>
            {nota.toFixed(1)}
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-0.5">nota</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ── SECTION 1: DESEMPENHO DO MÊS ANTERIOR ── */}
      {/* ═══════════════════════════════════════════════════ */}
      {hasPrevData && (
        <div className="space-y-3 opacity-0" style={{ animation: "fadeUp 0.5s ease-out 0.1s forwards" }}>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground/50" />
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
              Desempenho do mês anterior
            </p>
          </div>

          {/* Prev ranking */}
          {prevRank !== null && (
            <div className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-default">
              <Award className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              <span className="text-[13px] text-foreground/80 font-medium">
                Ranking final: <span className={cn("font-bold", prevRank <= 3 ? "text-emerald-500" : "text-foreground")}>{prevRank}º lugar</span>
                {prevRankTotal ? <span className="text-muted-foreground/50"> de {prevRankTotal}</span> : null}
              </span>
            </div>
          )}

          {/* Strengths */}
          {prevStrengths.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider ml-1">Pontos fortes</p>
              {prevStrengths.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-default opacity-0"
                  style={{ animation: `fadeUp 0.4s ease-out ${0.15 + i * 0.05}s forwards` }}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-emerald-500 shrink-0">{s.icon}</span>
                  <span className="text-[13px] text-foreground/80 font-medium">{s.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Weaknesses */}
          {prevWeaknesses.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider ml-1">Pontos de melhoria</p>
              {prevWeaknesses.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-default opacity-0"
                  style={{ animation: `fadeUp 0.4s ease-out ${0.25 + i * 0.05}s forwards` }}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-amber-500 shrink-0">{w.icon}</span>
                  <span className="text-[13px] text-foreground/80 font-medium">{w.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      {hasPrevData && <div className="border-t border-border/30" />}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ── SECTION 2: DIRECIONAMENTO PARA O MÊS ATUAL ── */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="space-y-3 opacity-0" style={{ animation: "fadeUp 0.5s ease-out 0.35s forwards" }}>
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-muted-foreground/50" />
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
            Direcionamento para este mês
          </p>
        </div>

        {/* Tips */}
        {directionTips.map((tip, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-default opacity-0"
            style={{ animation: `fadeUp 0.4s ease-out ${0.4 + i * 0.05}s forwards` }}
          >
            <ChevronRight className="h-3.5 w-3.5 text-sidebar shrink-0" />
            <span className="text-[13px] text-foreground/80 font-medium">{tip}</span>
          </div>
        ))}

        {/* Focus highlight */}
        <div
          className="flex items-center gap-2.5 mt-2 py-2.5 px-3 rounded-xl bg-sidebar/5 border border-sidebar/10 opacity-0"
          style={{ animation: "fadeUp 0.5s ease-out 0.55s forwards" }}
        >
          <Crosshair className="h-4 w-4 text-sidebar shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] font-semibold text-sidebar/60 uppercase tracking-widest">Seu foco este mês</span>
            <p className="text-[13px] font-semibold text-sidebar mt-0.5">{focusGoal}</p>
          </div>
        </div>
      </div>

      {/* ── Empty state ── */}
      {total === 0 && !hasPrevData && (
        <p className="text-sm text-muted-foreground/50 text-center py-3">Sem dados suficientes para gerar insights.</p>
      )}
    </div>
  );
}
