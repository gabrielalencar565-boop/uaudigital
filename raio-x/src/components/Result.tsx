"use client";

import { useEffect, useState } from "react";
import { AREAS, COPY, STRONGEST_TEXT } from "@/data/raiox";
import { bandFor, rankedAreas, type Answers, type RaioXResult } from "@/lib/scoring";
import { firstName } from "@/lib/validation";
import { BandLegend } from "./AreaBars";
import AreaDiagnosis from "./AreaDiagnosis";
import Logo from "./Logo";
import RadarChart from "./RadarChart";
import Rich from "./Rich";
import ShareImage from "./ShareImage";

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

type Props = { result: RaioXResult; answers: Answers; name: string; onRestart: () => void };

export default function Result({ result, answers, name, onRestart }: Props) {
  const shown = useCountUp(result.overall);
  const first = firstName(name);
  const bottleneck = AREAS.find((a) => a.id === result.bottleneck)!;
  const strongest = AREAS.find((a) => a.id === result.strongest)!;
  const { level } = result;
  const plan = rankedAreas(result.areas)
    .slice(0, 3)
    .map((id) => AREAS.find((a) => a.id === id)!);

  return (
    <div className="relative isolate flex flex-col gap-6 pt-5 pb-12">
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[520px] w-screen -translate-x-1/2 overflow-hidden">
        <div className="orb -top-40 -right-40 size-[440px] bg-purple" />
      </div>

      <header className="flex justify-center">
        <Logo className="h-9" />
      </header>

      <section className="flex flex-col items-center pt-6 text-center">
        <p className="eyebrow">Diagnóstico{first ? ` de ${first}` : " completo"}</p>
        <h1 data-autofocus tabIndex={-1} className="mt-3">
          <span className="sr-only">Sua nota geral é {result.overall} de 100.</span>
          <span aria-hidden="true" className="flex items-baseline justify-center tabular-nums">
            <span className="grad-text text-[8rem] leading-[0.9] font-extrabold tracking-[-0.06em]">{shown}</span>
            <span className="ml-1 text-[2.25rem] font-light tracking-[-0.03em] text-dim">/100</span>
          </span>
        </h1>
      </section>

      <section className="grad-border rounded-3xl p-6">
        <p className="eyebrow">Seu nível</p>
        <h2 className="title mt-3 text-[2rem]">
          <b>{level.name}</b> <span aria-hidden="true">{level.emoji}</span>
        </h2>
        <p className="mt-3 leading-relaxed text-muted">{level.description}</p>
      </section>

      <section className="rounded-3xl border border-line bg-bg2 p-6">
        <h2 className="title text-2xl">
          Visão <b>geral</b>
        </h2>
        <RadarChart scores={result.areas} />
      </section>

      <section className="on-light rounded-3xl bg-light p-6 text-ink">
        <p className="eyebrow">Seu principal gargalo</p>
        <h2 className="title mt-3 text-[2.25rem]">
          <b className="grad-text">{bottleneck.name}</b> <span aria-hidden="true">{bottleneck.emoji}</span>
        </h2>
        <p className="mt-1 text-sm font-semibold text-ink-muted">
          Nota {result.areas[bottleneck.id]} · {bandFor(result.areas[bottleneck.id]).name}
        </p>
        <p className="mt-4 text-[17px] leading-relaxed">{bottleneck.bottleneck.diagnosis}</p>
        <div className="mt-5 rounded-2xl bg-ink p-5 text-fg">
          <p className="text-xs font-semibold tracking-[0.18em] text-lilac uppercase">Primeiro passo 👉</p>
          <p className="mt-2 leading-relaxed">{bottleneck.bottleneck.firstStep}</p>
        </div>
      </section>

      <section className="px-1 pt-4">
        <p className="eyebrow">Seu plano de ação</p>
        <h2 className="title mt-3 text-[2rem]">
          Por onde <b>começar</b>
        </h2>
        <p className="mt-2 leading-relaxed text-muted">Os 3 passos que mais mudam a forma como o seu cliente te enxerga, na ordem.</p>
        <ol className="mt-5 flex flex-col gap-3">
          {plan.map((a, i) => (
            <li key={a.id} className="flex gap-4 rounded-3xl border border-line bg-bg2 p-5">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
                style={{ background: "var(--grad)" }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">
                  {a.name} <span className="font-normal text-dim">· nota {result.areas[a.id]}</span>
                </p>
                <p className="mt-1 leading-relaxed text-muted">{a.bottleneck.firstStep}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-1 pt-4">
        <p className="eyebrow">Área por área</p>
        <h2 className="title mt-3 text-[2rem]">
          Seu diagnóstico <b>completo</b>
        </h2>
        <p className="mt-2 leading-relaxed text-muted">O que suas respostas mostram e o que um estrategista faria no seu lugar.</p>
        <div className="mt-5">
          <BandLegend />
        </div>
      </section>

      {AREAS.map((a) => (
        <AreaDiagnosis key={a.id} area={a} score={result.areas[a.id]} answers={answers} />
      ))}

      <section className="rounded-3xl border border-line bg-bg2 p-6">
        <p className="eyebrow">Sua área mais forte</p>
        <h2 className="title mt-3 text-2xl">
          <span aria-hidden="true">{strongest.emoji}</span> <b>{strongest.name}</b> · {result.areas[strongest.id]}
        </h2>
        <p className="mt-2 leading-relaxed text-muted">{STRONGEST_TEXT.replace("{AREA}", strongest.name)}</p>
      </section>

      <section className="px-1 pt-2">
        <h2 className="title text-[2rem]">
          O que isso <b>significa</b>
        </h2>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">{level.meaning}</p>
      </section>

      <ShareImage overall={result.overall} level={level} scores={result.areas} name={first} />

      <section className="rounded-3xl p-7 text-white" style={{ background: "var(--grad)" }}>
        <h2 className="title text-[2rem]">
          <Rich text={COPY.result.ctaTitle} gradient={false} />
        </h2>
        <p className="mt-3 text-[17px] leading-relaxed text-white/90">{COPY.result.ctaText}</p>
        <a href={COPY.result.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn-white mt-6">
          {COPY.result.ctaButton} <span className="arr" aria-hidden="true">↗</span>
        </a>
      </section>

      <button
        type="button"
        onClick={onRestart}
        className="mx-auto min-h-12 rounded-xl px-4 font-medium text-dim underline underline-offset-4 hover:text-fg"
      >
        {COPY.result.restart}
      </button>
    </div>
  );
}
