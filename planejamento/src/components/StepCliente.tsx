"use client";

import { useState } from "react";
import { NICHOS } from "@/data/formulario";
import type { Erros, Rascunho } from "@/lib/rascunho";
import { Campo, Erro, inputClass } from "./ui";

type Props = { r: Rascunho; set: <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => void; erros: Erros };

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function StepCliente({ r, set, erros }: Props) {
  const [busca, setBusca] = useState("");
  const filtrados = NICHOS.filter((n) => n.id === "outro" || normalizar(n.nome).includes(normalizar(busca)));

  return (
    <>
      <Campo
        id="cliente"
        label="Nome do cliente ou da marca"
        value={r.cliente}
        onChange={(v) => set("cliente", v)}
        placeholder="Ex.: Clínica Aurora"
        erro={erros.cliente}
        maxLength={80}
        autoCapitalize="words"
      />

      <fieldset aria-describedby={erros.nicho ? "nicho-erro" : undefined}>
        <legend className="mb-2 font-bold">Nicho</legend>
        <label htmlFor="nicho-busca" className="sr-only">
          Buscar nicho
        </label>
        <input
          id="nicho-busca"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔎 Buscar nicho"
          className={`${inputClass} h-12 text-base`}
          autoComplete="off"
        />
        <div role="radiogroup" aria-label="Nichos" className="mt-3 flex flex-wrap gap-2">
          {filtrados.map((n) => {
            const on = r.nicho === n.id;
            return (
              <button
                key={n.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set("nicho", n.id)}
                className={`min-h-11 rounded-full border-2 px-4 text-[15px] font-medium transition-colors ${
                  on ? "border-roxo bg-roxo text-white" : "border-borda bg-card text-white hover:border-[#3a3546]"
                }`}
              >
                {n.nome}
              </button>
            );
          })}
        </div>
        <Erro id="nicho-erro" msg={erros.nicho} />
      </fieldset>

      {r.nicho === "outro" ? (
        <Campo
          id="nichoOutro"
          label="Qual é o nicho?"
          value={r.nichoOutro}
          onChange={(v) => set("nichoOutro", v)}
          placeholder="Ex.: Ótica"
          erro={erros.nichoOutro}
          maxLength={60}
        />
      ) : null}

      <Campo
        id="servico"
        label="Principal serviço ou produto que ele quer vender mais"
        value={r.servico}
        onChange={(v) => set("servico", v)}
        placeholder="Ex.: clareamento dental"
        erro={erros.servico}
        maxLength={120}
      />

      <Campo
        id="cidade"
        label="Cidade ou região"
        opcional
        dica="Deixa em branco se ele atende online."
        value={r.cidade}
        onChange={(v) => set("cidade", v)}
        placeholder="Ex.: Teresina"
        maxLength={80}
        autoCapitalize="words"
      />
    </>
  );
}
