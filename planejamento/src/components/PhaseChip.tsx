import { FASES, type FaseId } from "@/data/fases";

export default function PhaseChip({ fase, comFuncao = false }: { fase: FaseId; comFuncao?: boolean }) {
  const f = FASES[fase];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold tracking-wide whitespace-nowrap"
      style={{ background: f.cor, color: f.corTexto }}
    >
      {f.nome}
      {comFuncao ? <span className="ml-1 font-medium">· {f.funcao}</span> : null}
    </span>
  );
}
