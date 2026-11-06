"use client";

import { FORMATOS, POSTS_POR_SEMANA, TONS, type FormatoId } from "@/data/formulario";
import type { Erros, Rascunho } from "@/lib/rascunho";
import { Campo, Grupo, Opcao } from "./ui";

type Props = { r: Rascunho; set: <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => void; erros: Erros };

export default function StepPerfil({ r, set, erros }: Props) {
  function alternar(id: FormatoId) {
    set("formatos", r.formatos.includes(id) ? r.formatos.filter((f) => f !== id) : [...r.formatos, id]);
  }
  return (
    <>
      <Grupo legenda="Quantos posts por semana dá pra fazer?" id="postsPorSemana" erro={erros.postsPorSemana}>
        <div role="radiogroup" aria-label="Posts por semana" className="grid grid-cols-4 gap-2">
          {POSTS_POR_SEMANA.map((n) => {
            const on = r.postsPorSemana === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${n} posts por semana`}
                onClick={() => set("postsPorSemana", n)}
                className={`h-14 rounded-2xl border-[1.5px] text-xl font-extrabold transition-colors ${
                  on ? "grad-border text-fg" : "border-line bg-bg2 text-fg hover:border-[#3d3846]"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </Grupo>

      <Grupo legenda="Quais formatos o cliente topa?" dica="Pode marcar mais de um." id="formatos" erro={erros.formatos}>
        <div className="flex flex-col gap-2">
          {FORMATOS.map((f) => (
            <Opcao key={f.id} multipla compacto selecionado={r.formatos.includes(f.id)} onClick={() => alternar(f.id)}>
              <span aria-hidden="true" className="mr-1.5">
                {f.icone}
              </span>
              {f.nome}
            </Opcao>
          ))}
        </div>
      </Grupo>

      <Grupo legenda="Tom de voz da marca" id="tom" erro={erros.tom}>
        <div role="radiogroup" aria-label="Tom de voz" className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          {TONS.map((t) => (
            <Opcao key={t.id} compacto selecionado={r.tom === t.id} onClick={() => set("tom", t.id)}>
              {t.nome}
            </Opcao>
          ))}
        </div>
      </Grupo>

      <Campo
        id="dataEspecial"
        label="Tem alguma data ou ação importante no mês?"
        opcional
        value={r.dataEspecial}
        onChange={(v) => set("dataEspecial", v)}
        placeholder="Ex.: promoção de aniversário dia 20"
        maxLength={160}
      />
    </>
  );
}
