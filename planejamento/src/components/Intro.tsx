import { COPY } from "@/data/textos";
import Logo from "./Logo";

type Props = { onComecar: () => void; onContinuar?: () => void };

export default function Intro({ onComecar, onContinuar }: Props) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-5">
        <Logo />
      </header>
      <div className="flex flex-1 flex-col justify-center py-10">
        <p className="mb-5 inline-flex w-fit rounded-full border border-white/40 px-3 py-1.5 text-xs font-bold tracking-[0.14em]">
          {COPY.intro.selo}
        </p>
        <h1 data-autofocus tabIndex={-1} className="title text-[2.75rem] sm:text-5xl">
          {COPY.intro.titulo}
        </h1>
        <p className="mt-5 text-lg leading-snug text-white/90">{COPY.intro.subtitulo}</p>
        <ul className="mt-8 flex flex-col gap-3">
          {COPY.intro.bullets.map((b) => (
            <li key={b.texto} className="flex items-center gap-3 rounded-2xl border border-white/25 px-4 py-3 text-[17px] font-medium">
              <span aria-hidden="true" className="text-xl">
                {b.emoji}
              </span>
              {b.texto}
            </li>
          ))}
        </ul>
      </div>
      <div className="sticky bottom-0 -mx-5 bg-roxo px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {onContinuar ? (
          <>
            <button type="button" onClick={onContinuar} className="btn-primary">
              {COPY.intro.continuar} <span aria-hidden="true">→</span>
            </button>
            <button type="button" onClick={onComecar} className="mt-2 h-12 w-full rounded-2xl font-bold text-white underline-offset-4 hover:underline">
              {COPY.intro.recomecar}
            </button>
          </>
        ) : (
          <button type="button" onClick={onComecar} className="btn-primary">
            {COPY.intro.cta} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
