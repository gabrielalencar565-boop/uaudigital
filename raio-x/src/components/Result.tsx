"use client";

import { useEffect, useState } from "react";
import { AREAS, COPY, STRONGEST_TEXT } from "@/data/raiox";
import { bandFor, type RaioXResult } from "@/lib/scoring";
import { firstName } from "@/lib/validation";
import AreaBars from "./AreaBars";
import Logo from "./Logo";
import RadarChart from "./RadarChart";
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

type Props = { result: RaioXResult; name: string; onRestart: () => void };

export default function Result({ result, name, onRestart }: Props) {
  const shown = useCountUp(result.overall);
  const first = firstName(name);
  const bottleneck = AREAS.find((a) => a.id === result.bottleneck)!;
  const strongest = AREAS.find((a) => a.id === result.strongest)!;
  const { level } = result;

  return (
    <div className="flex flex-col gap-6 pt-3 pb-12">
      <header className="flex justify-center">
        <Logo />
      </header>

      <section className="pt-4 text-center">
        <p className="text-sm font-bold tracking-[0.14em] text-amarelo uppercase">Seu raio-x{first ? `, ${first}` : ""}</p>
        <h1 data-autofocus tabIndex={-1} className="mt-2">
          <span className="sr-only">Sua nota geral é {result.overall} de 100.</span>
          <span aria-hidden="true" className="title block text-[7.5rem] leading-none tabular-nums">
            {shown}
            <span className="text-[2.5rem] text-muted">/100</span>
          </span>
        </h1>
      </section>

      <section className="rounded-3xl border-2 border-roxo bg-card p-5">
        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Seu nível</p>
        <h2 className="title mt-2 text-[1.75rem]">
          {level.name} <span aria-hidden="true">{level.emoji}</span>
        </h2>
        <p className="mt-2 leading-snug text-white/85">{level.description}</p>
      </section>

      <section className="rounded-3xl border border-borda bg-card p-5">
        <h2 className="title text-xl">Suas 6 áreas</h2>
        <RadarChart scores={result.areas} />
      </section>

      <section className="rounded-3xl border border-borda bg-card p-5">
        <h2 className="title mb-4 text-xl">Nota por área</h2>
        <AreaBars scores={result.areas} />
      </section>

      <section className="on-yellow rounded-3xl bg-amarelo p-6 text-ink">
        <p className="text-xs font-extrabold tracking-[0.14em] uppercase">Seu principal gargalo</p>
        <h2 className="title mt-2 text-[2rem]">
          {bottleneck.name} <span aria-hidden="true">{bottleneck.emoji}</span>
        </h2>
        <p className="mt-1 text-sm font-bold">
          Nota {result.areas[bottleneck.id]} · {bandFor(result.areas[bottleneck.id]).name}
        </p>
        <p className="mt-4 text-[17px] leading-snug">{bottleneck.bottleneck.diagnosis}</p>
        <div className="mt-5 rounded-2xl bg-ink p-4 text-white">
          <p className="text-xs font-extrabold tracking-[0.14em] text-amarelo uppercase">Primeiro passo 👉</p>
          <p className="mt-2 leading-snug">{bottleneck.bottleneck.firstStep}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-borda bg-card p-5">
        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Sua área mais forte</p>
        <h2 className="title mt-2 text-xl">
          <span aria-hidden="true">{strongest.emoji}</span> {strongest.name} · {result.areas[strongest.id]}
        </h2>
        <p className="mt-2 leading-snug text-white/85">{STRONGEST_TEXT.replace("{AREA}", strongest.name)}</p>
      </section>

      <section className="px-1">
        <h2 className="title text-2xl">O que isso significa</h2>
        <p className="mt-3 text-[17px] leading-relaxed text-white/85">{level.meaning}</p>
      </section>

      <ShareImage overall={result.overall} level={level} scores={result.areas} name={first} />

      <section className="rounded-3xl bg-roxo p-6">
        <h2 className="title text-[1.75rem]">{COPY.result.ctaTitle}</h2>
        <p className="mt-3 text-[17px] leading-snug">{COPY.result.ctaText}</p>
        <a href={COPY.result.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5">
          {COPY.result.ctaButton}
        </a>
      </section>

      <button
        type="button"
        onClick={onRestart}
        className="mx-auto min-h-12 rounded-xl px-4 font-medium text-muted underline underline-offset-4 hover:text-white"
      >
        {COPY.result.restart}
      </button>
    </div>
  );
}
