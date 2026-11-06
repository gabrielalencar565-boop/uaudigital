import { AREAS, COPY } from "@/data/raiox";
import Logo from "./Logo";

type Props = {
  onStart: () => void;
  /** Se existe progresso salvo, oferece continuar. */
  resumeLabel?: string;
  onResume?: () => void;
};

export default function Intro({ onStart, resumeLabel, onResume }: Props) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-2">
        <Logo />
      </header>

      <div className="flex flex-1 flex-col justify-center py-10">
        <p className="mb-5 inline-flex w-fit items-center rounded-full border border-white/40 px-3 py-1.5 text-xs font-bold tracking-[0.14em]">
          {COPY.intro.badge}
        </p>
        <h1 data-autofocus tabIndex={-1} className="title text-[2.6rem] sm:text-5xl">
          {COPY.intro.title}
        </h1>
        <p className="mt-5 text-lg leading-snug text-white/90">{COPY.intro.subtitle}</p>

        <h2 className="mt-9 text-xs font-bold tracking-[0.14em] text-white/80 uppercase">{COPY.intro.areasTitle}</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {AREAS.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-2xl border border-white/25 px-3 py-2.5 text-[15px] font-medium"
            >
              <span aria-hidden="true" className="text-lg">
                {a.emoji}
              </span>
              {a.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="sticky bottom-0 -mx-5 bg-roxo px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {onResume && resumeLabel ? (
          <>
            <button type="button" onClick={onResume} className="btn-primary">
              {resumeLabel}
            </button>
            <button type="button" onClick={onStart} className="mt-2 h-12 w-full rounded-2xl font-bold text-white underline-offset-4 hover:underline">
              Começar do zero
            </button>
          </>
        ) : (
          <button type="button" onClick={onStart} className="btn-primary">
            {COPY.intro.cta} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
