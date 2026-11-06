import { BANDS, COPY, QUESTIONS, type Area } from "@/data/raiox";
import { bandFor, type Answers } from "@/lib/scoring";
import { BAND_COLORS, BandBar } from "./AreaBars";

/** Uma área do diagnóstico completo: nota, análise e as respostas da pessoa. */
export default function AreaDiagnosis({ area, score, answers }: { area: Area; score: number; answers: Answers }) {
  const band = bandFor(score);
  const bandColor = BAND_COLORS[BANDS.findIndex((b) => b.id === band.id)];
  const questions = QUESTIONS.filter((q) => q.area === area.id);

  return (
    <article className="rounded-3xl border border-line bg-bg2 p-6">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] text-dim uppercase">
            Área {area.number} ·{" "}
            <span style={{ color: band.id === "critico" ? "#B9B4C4" : bandColor }}>{band.name}</span>
          </p>
          <h3 className="title mt-1.5 text-[1.6rem]">
            <span aria-hidden="true">{area.emoji}</span> <b>{area.name}</b>
          </h3>
        </div>
        <p className="shrink-0 text-3xl font-extrabold tracking-[-0.03em] tabular-nums">
          {score}
          <span className="sr-only"> de 100</span>
        </p>
      </header>

      <div className="mt-4">
        <BandBar score={score} />
      </div>

      <p className="mt-5 leading-relaxed text-muted">{area.analysis[band.id]}</p>

      <ul className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
        {questions.map((q) => {
          const option = q.options[answers[q.id]];
          if (!option) return null;
          const ok = option.points === 3;
          return (
            <li key={q.id} className="rounded-2xl bg-bg3 p-4">
              <p className="text-sm text-dim">{q.text}</p>
              <p className="mt-2 text-[15px] font-semibold">
                <span className="text-dim">Você respondeu:</span> “{option.text.replace(/^"|"$/g, "")}”
              </p>
              {ok ? (
                <p className="mt-3 flex gap-2 text-[15px] text-lilac">
                  <span aria-hidden="true">✓</span> {COPY.result.answerOk}
                </p>
              ) : (
                <div className="mt-3 border-l-2 border-purple pl-3">
                  <p className="text-xs font-semibold tracking-[0.14em] text-lilac uppercase">Como um estrategista faz</p>
                  <p className="mt-1 text-[15px] leading-relaxed">{q.tip}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
