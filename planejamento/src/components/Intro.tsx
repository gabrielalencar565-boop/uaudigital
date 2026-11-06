import { COPY } from "@/data/textos";
import Logo from "./Logo";
import Rich from "./Rich";

type Props = { onComecar: () => void; onContinuar?: () => void };

export default function Intro({ onComecar, onContinuar }: Props) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden">
        <div className="orb -top-40 -right-40 size-[460px] bg-purple" />
        <div className="orb -bottom-48 -left-40 size-[360px] bg-magenta opacity-15" />
      </div>

      <header className="flex justify-center pt-5">
        <Logo className="h-9" />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <p className="eyebrow">{COPY.intro.selo}</p>
        <h1 data-autofocus tabIndex={-1} className="title mt-5 text-[2.75rem] sm:text-[3.25rem]">
          <Rich text={COPY.intro.titulo} />
        </h1>
        <p className="mt-5 max-w-[25rem] text-[17px] leading-relaxed text-muted">{COPY.intro.subtitulo}</p>
        <ul className="mt-8 flex w-full flex-col gap-2.5 text-left">
          {COPY.intro.bullets.map((b) => (
            <li key={b.texto} className="flex items-center gap-3 rounded-2xl border border-line bg-bg2/70 px-4 py-3.5 text-[16px] font-medium">
              <span aria-hidden="true" className="text-xl">
                {b.emoji}
              </span>
              {b.texto}
            </li>
          ))}
        </ul>
      </div>

      <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {onContinuar ? (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={onContinuar} className="btn-main">
              {COPY.intro.continuar} <span className="arr" aria-hidden="true">↗</span>
            </button>
            <button type="button" onClick={onComecar} className="btn-ghost text-muted">
              {COPY.intro.recomecar}
            </button>
          </div>
        ) : (
          <button type="button" onClick={onComecar} className="btn-main">
            {COPY.intro.cta} <span className="arr" aria-hidden="true">↗</span>
          </button>
        )}
      </div>
    </div>
  );
}
