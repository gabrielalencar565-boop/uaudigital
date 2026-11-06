import { AREAS, type Area } from "@/data/raiox";

export default function AreaDone({ area, areaIndex, onContinue }: { area: Area; areaIndex: number; onContinue: () => void }) {
  const total = AREAS.length;
  return (
    <div className="on-light flex min-h-dvh flex-col text-ink">
      <div className="flex flex-1 flex-col justify-center py-10">
        <p className="eyebrow">
          Área {area.number} de {String(total).padStart(2, "0")}
        </p>
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          {AREAS.map((a, i) => (
            <span
              key={a.id}
              className={`h-1.5 flex-1 rounded-full ${i <= areaIndex ? "" : "bg-ink/10"}`}
              style={i <= areaIndex ? { background: "var(--grad)" } : undefined}
            />
          ))}
        </div>
        <h1 data-autofocus tabIndex={-1} className="title mt-10 text-[clamp(2.4rem,12vw,3.5rem)] break-words">
          <b className="grad-text">{area.name}</b>
          <br />
          {area.doneWord}. <span aria-hidden="true">{area.emoji}</span>
        </h1>
        <p className="mt-5 text-xl leading-snug text-ink-muted">{area.doneText}</p>
      </div>
      <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onContinue} className="btn-main">
          {areaIndex === total - 1 ? "Ver meu diagnóstico" : "Continuar"} <span className="arr" aria-hidden="true">↗</span>
        </button>
      </div>
    </div>
  );
}
