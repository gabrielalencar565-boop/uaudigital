import { AREAS, type Area } from "@/data/raiox";

export default function AreaDone({ area, areaIndex, onContinue }: { area: Area; areaIndex: number; onContinue: () => void }) {
  const total = AREAS.length;
  return (
    <div className="on-yellow flex min-h-dvh flex-col text-ink">
      <div className="flex flex-1 flex-col justify-center py-10">
        <p className="text-lg font-extrabold tabular-nums">
          {area.number} / {String(total).padStart(2, "0")}
        </p>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {AREAS.map((a, i) => (
            <span key={a.id} className={`h-1.5 flex-1 rounded-full ${i <= areaIndex ? "bg-ink" : "bg-ink/20"}`} />
          ))}
        </div>
        <h1 data-autofocus tabIndex={-1} className="title mt-10 text-[clamp(2rem,10.5vw,3.25rem)] break-words">
          <span className="text-roxo">{area.name.toUpperCase()}</span> {area.doneWord}.{" "}
          <span aria-hidden="true">{area.emoji}</span>
        </h1>
        <p className="mt-5 text-xl leading-snug font-medium">{area.doneText}</p>
      </div>
      <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onContinue} className="btn-dark">
          Continuar <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
