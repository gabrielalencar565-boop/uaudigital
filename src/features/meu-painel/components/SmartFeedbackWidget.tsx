import { useMemo } from "react";
import {
  Sparkles, Trophy, Clock, Target,
  Gem, ShieldCheck, FolderKanban, BookOpen,
  AlertCircle, ArrowUpRight,
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
  prevMonthDone: number;
  qualitative: QualitativeScores | null;
  rank: number | null;
  rankTotal: number | null;
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

const FEEDBACK_MAP: Record<string, Record<number, string>> = {
  padrao_qualidade_uau: {
    4: "Sua qualidade está excelente, mantenha esse padrão",
    3: "Sua qualidade está boa, mas pode evoluir em consistência",
    2: "Sua qualidade precisa melhorar para evitar retrabalho",
    1: "Sua qualidade está comprometendo as entregas, é prioridade melhorar",
    0: "Sem avaliação registrada neste mês",
  },
  comprometimento: {
    4: "Seu comprometimento está exemplar, continue assim",
    3: "Bom comprometimento, mas pode ser mais constante",
    2: "Seu comprometimento precisa de mais atenção",
    1: "Falta de comprometimento está impactando os resultados",
    0: "Sem avaliação registrada neste mês",
  },
  ambiente_organizado: {
    4: "Sua organização está impecável, referência para o time",
    3: "Boa organização, mas há espaço para evoluir",
    2: "Sua organização precisa melhorar para manter o ritmo",
    1: "Desorganização está prejudicando suas entregas",
    0: "Sem avaliação registrada neste mês",
  },
  aprendizado_continuo: {
    4: "Excelente evolução contínua, continue investindo",
    3: "Bom progresso, mas pode buscar mais aprendizado",
    2: "Precisa investir mais em aprendizado e evolução",
    1: "Estagnação no aprendizado, busque se atualizar",
    0: "Sem avaliação registrada neste mês",
  },
};

function getFeedback(key: string, score: number): string {
  const map = FEEDBACK_MAP[key];
  if (!map) return "";
  if (score >= 4) return map[4]!;
  if (score >= 3) return map[3]!;
  if (score >= 2) return map[2]!;
  if (score >= 1) return map[1]!;
  return map[0]!;
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
  myTasks, teamAvgScore, myScore, todayKey, prevMonthDone, qualitative, rank, rankTotal,
}: Props) {
  const total = myTasks.length;
  const done = myTasks.filter((t) => t.status === "concluido").length;
  const doneOnTime = myTasks.filter((t) => {
    if (t.status !== "concluido" || !t.completed_at) return false;
    return t.completed_at.slice(0, 10) <= t.due_date;
  }).length;
  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;
  const pctOnTime = done > 0 ? Math.round((doneOnTime / done) * 100) : 100;

  // General score 0-10
  const nota = useMemo(() => {
    if (total === 0) return 0;
    const pctComplete = done / total;
    const pctPunctual = done > 0 ? doneOnTime / done : 1;
    const raw = (pctComplete * 5) + (pctPunctual * 5);
    return Math.round(raw * 10) / 10;
  }, [total, done, doneOnTime]);

  // Month delta
  const monthDelta = useMemo(() => {
    if (prevMonthDone <= 0) return null;
    return Math.round(((done - prevMonthDone) / prevMonthDone) * 100);
  }, [done, prevMonthDone]);

  // Headline
  const headline = useMemo(() => {
    if (nota >= 9) return { text: "Desempenho excepcional", sub: "Você é referência para o time este mês", emoji: "🏆" };
    if (nota >= 7) return { text: "Bom desempenho", sub: "Continue focado para manter o ritmo", emoji: "🚀" };
    if (nota >= 5) return { text: "Desempenho mediano", sub: "Há espaço claro para evoluir", emoji: "📋" };
    if (total > 0) return { text: "Atenção necessária", sub: "Reorganize suas prioridades", emoji: "⚠️" };
    return { text: "Sem dados", sub: "Nenhuma tarefa registrada neste mês", emoji: "📊" };
  }, [nota, total]);

  const notaColor = nota >= 8 ? "text-emerald-500" : nota >= 6 ? "text-amber-500" : "text-red-500";
  const notaBorder = nota >= 8 ? "border-emerald-500/20" : nota >= 6 ? "border-amber-500/20" : "border-red-500/20";
  const notaGlow = nota >= 8 ? "shadow-emerald-500/20" : nota >= 6 ? "shadow-amber-500/20" : "shadow-red-500/20";

  // "What to improve" tips
  const tips = useMemo(() => {
    const list: string[] = [];
    if (pctOnTime < 80 && total > 0) list.push("Melhore sua consistência nas entregas dentro do prazo");
    if (rank && rank > 3) list.push("Você pode subir no ranking com mais volume e pontualidade");

    if (qualitative) {
      const sorted = [...CRITERIA].sort((a, b) => (qualitative[a.key] ?? 0) - (qualitative[b.key] ?? 0));
      for (const c of sorted) {
        if ((qualitative[c.key] ?? 0) <= 2 && list.length < 4) {
          const label = c.label.toLowerCase();
          list.push(`Aprimore sua ${label} para evitar impactos nas entregas`);
        }
      }
    }

    if (prevMonthDone > 0 && done < prevMonthDone * 0.7 && total > 3) {
      list.push("Sua produtividade caiu em relação ao mês anterior");
    }

    return list.slice(0, 4);
  }, [pctOnTime, total, rank, qualitative, prevMonthDone, done]);

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-5 transition-all duration-300 hover:shadow-lg">

      {/* ── 1. HEADER ── */}
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

      {/* ── Dynamic delta ── */}
      {monthDelta !== null && (
        <div className="flex items-center gap-1.5 opacity-0" style={{ animation: "fadeUp 0.5s ease-out 0.15s forwards" }}>
          <ArrowUpRight className={cn("h-3.5 w-3.5", monthDelta >= 0 ? "text-emerald-500" : "text-red-500 rotate-90")} />
          <span className={cn("text-xs font-semibold tabular-nums", monthDelta >= 0 ? "text-emerald-500" : "text-red-500")}>
            {monthDelta >= 0 ? "+" : ""}{monthDelta}% vs mês anterior
          </span>
        </div>
      )}

      {/* ── 2. OBJECTIVE CRITERIA ── */}
      {total > 0 && (
        <div className="space-y-2 opacity-0" style={{ animation: "fadeUp 0.5s ease-out 0.2s forwards" }}>
          <div className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-default group">
            <Clock className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            <span className="text-[13px] text-foreground/80 font-medium">
              Você entregou <span className={cn("font-bold", pctOnTime >= 80 ? "text-emerald-500" : pctOnTime >= 50 ? "text-amber-500" : "text-red-500")}>{pctOnTime}%</span> das tarefas no prazo
            </span>
          </div>

          {rank !== null && (
            <div className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-default group">
              <Trophy className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              <span className="text-[13px] text-foreground/80 font-medium">
                Você está em <span className={cn("font-bold", rank <= 3 ? "text-emerald-500" : "text-foreground")}>{rank}º lugar</span> no ranking do mês
                {rankTotal ? <span className="text-muted-foreground/50"> de {rankTotal}</span> : null}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── 3. QUALITATIVE CRITERIA (feedback only) ── */}
      {qualitative && (
        <div className="space-y-1.5 pt-1 opacity-0" style={{ animation: "fadeUp 0.5s ease-out 0.3s forwards" }}>
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1">Avaliação qualitativa</p>
          {CRITERIA.map((c, i) => {
            const score = qualitative[c.key] ?? 0;
            const color = feedbackColor(score);
            const text = getFeedback(c.key, score);
            return (
              <div
                key={c.key}
                className="flex items-start gap-2.5 py-1.5 px-1.5 -mx-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-default group opacity-0"
                style={{ animation: `fadeUp 0.4s ease-out ${0.35 + i * 0.06}s forwards` }}
              >
                <div className={cn("mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 transition-transform group-hover:scale-150", DOT_BG[color])} />
                <span className={cn("shrink-0 mt-px", ICON_FG[color])}>{c.icon}</span>
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold text-foreground/90">{c.label}</span>
                  <span className="text-[13px] text-muted-foreground/70"> — {text}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4. WHAT TO IMPROVE ── */}
      {tips.length > 0 && (
        <div className="space-y-1.5 pt-1 opacity-0" style={{ animation: "fadeUp 0.5s ease-out 0.55s forwards" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="h-3.5 w-3.5 text-muted-foreground/50" />
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">O que melhorar agora</p>
          </div>
          {tips.map((tip, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-default opacity-0"
              style={{ animation: `fadeUp 0.4s ease-out ${0.6 + i * 0.06}s forwards` }}
            >
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-[13px] text-foreground/80 font-medium">{tip}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {total === 0 && !qualitative && (
        <p className="text-sm text-muted-foreground/50 text-center py-3">Sem dados suficientes para gerar insights.</p>
      )}
    </div>
  );
}
