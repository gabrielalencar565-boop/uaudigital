"use client";

import { OBJETIVOS } from "@/data/formulario";
import type { Erros, Rascunho } from "@/lib/rascunho";
import { Grupo, Opcao } from "./ui";

type Props = { r: Rascunho; set: <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => void; erros: Erros };

export default function StepObjetivo({ r, set, erros }: Props) {
  return (
    <Grupo legenda="Escolhe 1" id="objetivo" erro={erros.objetivo}>
      <div role="radiogroup" aria-label="Objetivo do mês" className="flex flex-col gap-3">
        {OBJETIVOS.map((o) => (
          <Opcao key={o.id} selecionado={r.objetivo === o.id} onClick={() => set("objetivo", o.id)}>
            <span aria-hidden="true" className="mr-1.5">
              {o.emoji}
            </span>
            {o.nome}
          </Opcao>
        ))}
      </div>
    </Grupo>
  );
}
