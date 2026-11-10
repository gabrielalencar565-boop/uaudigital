"use client";

import { OBJECOES, type ObjecaoId } from "@/data/formulario";
import type { Erros, Rascunho } from "@/lib/rascunho";
import { Campo, Grupo, Opcao } from "./ui";

type Props = { r: Rascunho; set: <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => void; erros: Erros };

export default function StepPublico({ r, set, erros }: Props) {
  function alternar(id: ObjecaoId) {
    set("objecoes", r.objecoes.includes(id) ? r.objecoes.filter((o) => o !== id) : [...r.objecoes, id]);
  }
  return (
    <>
      <Campo
        id="publico"
        label="Quem é o cliente ideal?"
        value={r.publico}
        onChange={(v) => set("publico", v)}
        placeholder="Ex.: mulheres de 25 a 45 anos"
        erro={erros.publico}
      />
      <Campo
        id="dor"
        label="Qual a maior dor ou vontade dessa pessoa?"
        value={r.dor}
        onChange={(v) => set("dor", v)}
        placeholder="Ex.: vergonha de sorrir nas fotos"
        erro={erros.dor}
        multilinha
        maxLength={200}
      />
      <Grupo legenda="O que faz ela hesitar antes de comprar?" dica="Pode marcar mais de uma." id="objecoes" erro={erros.objecoes}>
        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          {OBJECOES.map((o) => (
            <Opcao key={o.id} multipla compacto selecionado={r.objecoes.includes(o.id)} onClick={() => alternar(o.id)}>
              {o.nome}
            </Opcao>
          ))}
        </div>
      </Grupo>
      <Campo
        id="objecaoOutro"
        label="Outro motivo"
        opcional
        value={r.objecaoOutro}
        onChange={(v) => set("objecaoOutro", v)}
        placeholder="Ex.: acha que vai ficar artificial"
        maxLength={120}
      />
    </>
  );
}
