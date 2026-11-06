import { AREAS, COPY } from "@/data/raiox";
import Logo from "./Logo";
import Rich from "./Rich";

type Props = {
  onStart: () => void;
  /** Se existe progresso salvo, oferece continuar. */
  resumeLabel?: string;
  onResume?: () => void;
};

export default function Intro({ onStart, resumeLabel, onResume }: Props) {
  const band = [...AREAS, ...AREAS];
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
        <p className="eyebrow">{COPY.intro.badge}</p>
        <h1 data-autofocus tabIndex={-1} className="title mt-5 text-[2.75rem] sm:text-[3.25rem]">
          <Rich text={COPY.intro.title} />
        </h1>
        <p className="mt-5 max-w-[24rem] text-[17px] leading-relaxed text-muted">{COPY.intro.subtitle}</p>

        <dl className="mt-8 flex w-full justify-center gap-8">
          {COPY.intro.meta.map((m) => (
            <div key={m.label} className="flex flex-col items-center gap-0.5">
              <dt className="sr-only">{m.label}</dt>
              <dd className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">{m.value}</dd>
              <span aria-hidden="true" className="text-[13px] text-dim">
                {m.label}
              </span>
            </div>
          ))}
        </dl>
      </div>

      <div className="-mx-5 border-y border-line py-4 text-muted">
        <p className="sr-only">
          {COPY.intro.areasTitle}: {AREAS.map((a) => a.name).join(", ")}.
        </p>
        <div className="marquee" aria-hidden="true">
          <div className="track">
            {band.map((a, i) => (
              <span key={i} className="flex items-center gap-6 px-6 text-sm font-medium tracking-[0.14em] whitespace-nowrap uppercase">
                <span>
                  {a.emoji} {a.name}
                </span>
                <span className="size-1.5 rounded-full bg-lilac" />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {onResume && resumeLabel ? (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={onResume} className="btn-main">
              {resumeLabel} <span className="arr" aria-hidden="true">↗</span>
            </button>
            <button type="button" onClick={onStart} className="btn-ghost text-muted">
              Começar do zero
            </button>
          </div>
        ) : (
          <button type="button" onClick={onStart} className="btn-main">
            {COPY.intro.cta} <span className="arr" aria-hidden="true">↗</span>
          </button>
        )}
      </div>
    </div>
  );
}
