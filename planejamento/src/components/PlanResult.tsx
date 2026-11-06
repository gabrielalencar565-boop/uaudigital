"use client";

import { useState } from "react";
import { FASES_LISTA } from "@/data/fases";
import { COPY } from "@/data/textos";
import { withBase } from "@/lib/base";
import type { PlanoSalvo } from "@/lib/plano";
import { planoParaTexto } from "@/lib/texto";
import Logo from "./Logo";
import PhaseChip from "./PhaseChip";
import WeekBlock from "./WeekBlock";

type Acoes = {
  onGerarDeNovo: () => void;
  onOutroCliente: () => void;
  gerando?: boolean;
  erro?: string;
};

function nomeArquivo(salvo: PlanoSalvo) {
  const base = `planejamento-${salvo.meta.mes}-${salvo.meta.cliente}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}.pdf`;
}

export default function PlanResult({ salvo, acoes }: { salvo: PlanoSalvo; acoes?: Acoes }) {
  const { plano, meta } = salvo;
  const [aviso, setAviso] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  async function baixarPdf() {
    if (baixando) return;
    setBaixando(true);
    setAviso(null);
    try {
      const res = await fetch(withBase("/api/pdf"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano, meta }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo(salvo);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setAviso("Não deu pra gerar o PDF agora. Tenta de novo em alguns segundos.");
    } finally {
      setBaixando(false);
    }
  }

  async function copiar() {
    const texto = planoParaTexto(salvo);
    try {
      await navigator.clipboard.writeText(texto);
      setAviso(COPY.resultado.copiado);
    } catch {
      // Navegadores sem permissão de clipboard: seleciona num textarea.
      const t = document.createElement("textarea");
      t.value = texto;
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand?.("copy");
      t.remove();
      setAviso(ok ? COPY.resultado.copiado : "Não consegui copiar automaticamente. Tenta pelo PDF.");
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-5 pb-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <div>
          <p className="text-sm font-bold tracking-[0.14em] text-amarelo uppercase">
            Planejamento de {meta.mes.split(" de ")[0]} · {meta.cliente}
          </p>
          <h1 data-autofocus tabIndex={-1} className="title mt-2 text-[2.4rem] sm:text-5xl">
            O mês de {meta.cliente} tá planejado. 🗓️
          </h1>
          <p className="mt-2 text-muted">{meta.nicho}</p>
          {acoes ? (
            <p className="mt-3 text-sm text-muted">
              🔗 Pra reabrir depois:{" "}
              <a href={withBase(`/p/${salvo.id}`)} className="font-bold text-white underline underline-offset-4">
                link deste planejamento
              </a>
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="on-yellow rounded-3xl bg-amarelo p-6 text-ink lg:col-span-2">
          <p className="text-xs font-extrabold tracking-[0.14em] uppercase">Objetivo do mês 🎯</p>
          <p className="title mt-3 text-[1.6rem] leading-tight">{plano.objetivo_mes}</p>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plano.metas.map((m) => (
              <li key={m.meta} className="rounded-2xl bg-ink p-4 text-white">
                <p className="font-extrabold">{m.meta}</p>
                <p className="mt-1 text-[15px] text-white/85">{m.indicador}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-medium">{COPY.resultado.metasAviso}</p>
        </section>

        <section className="rounded-3xl border border-borda bg-card p-6">
          <h2 className="title text-xl">Para quem estamos falando 👥</h2>
          <dl className="mt-4 flex flex-col gap-3">
            {[
              ["Perfil", plano.publico.perfil],
              ["Dor", plano.publico.dor],
              ["Desejo", plano.publico.desejo],
              ["Objeção principal", plano.publico.objecao_principal],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="text-xs font-extrabold tracking-[0.14em] text-muted uppercase">{t}</dt>
                <dd className="mt-0.5 leading-snug">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-3xl border border-borda bg-card p-6">
          <h2 className="title text-xl">Tom de voz 🗣️</h2>
          <p className="mt-3 leading-snug text-white/85">{plano.tom_de_voz.descricao}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {plano.tom_de_voz.exemplos.map((e) => (
              <li key={e} className="rounded-2xl border border-borda px-4 py-3 text-[15px] leading-snug">
                “{e}”
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="fases-titulo" className="rounded-3xl border border-borda bg-card p-6">
        <h2 id="fases-titulo" className="title text-xl">
          As 6 fases da jornada 🧭
        </h2>
        <p className="mt-2 text-[15px] text-muted">Cada post tem um papel. Toca num post pra ver por que ele existe.</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {FASES_LISTA.map((f) => (
            <li key={f.id}>
              <PhaseChip fase={f.id} comFuncao />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-8">
        {plano.semanas.map((s) => (
          <WeekBlock key={s.numero} semana={s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-borda bg-card p-6">
          <h2 className="title text-xl">Stories da semana ⏱️</h2>
          <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 leading-snug marker:text-amarelo">
            {plano.stories_recorrentes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-roxo p-6">
          <h2 className="title text-xl">Como apresentar ao cliente 💬</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {plano.frases_para_apresentar.map((f) => (
              <li key={f} className="rounded-2xl bg-ink/25 px-4 py-3 leading-snug">
                “{f}”
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={baixarPdf} disabled={baixando} className="btn-primary sm:w-auto sm:flex-1 sm:px-6">
          <span aria-hidden="true">📄</span> {baixando ? "Gerando o PDF…" : COPY.resultado.pdf}
        </button>
        <button type="button" onClick={copiar} className="btn-outline sm:w-auto sm:flex-1 sm:px-6">
          <span aria-hidden="true">📋</span> {COPY.resultado.copiar}
        </button>
      </div>
      {acoes ? (
        <div className="-mt-1 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={acoes.onGerarDeNovo} disabled={acoes.gerando} className="btn-outline sm:flex-1">
            <span aria-hidden="true">🔄</span> {acoes.gerando ? "Gerando outra versão…" : COPY.resultado.gerarDeNovo}
          </button>
          <button type="button" onClick={acoes.onOutroCliente} disabled={acoes.gerando} className="btn-outline sm:flex-1">
            <span aria-hidden="true">➕</span> {COPY.resultado.outroCliente}
          </button>
        </div>
      ) : null}
      <p aria-live="polite" className="text-center text-[15px] font-medium text-amarelo empty:hidden">
        {acoes?.erro ?? aviso}
      </p>

      <section className="rounded-3xl bg-roxo p-6">
        <p className="title text-[1.6rem] leading-tight">{COPY.resultado.ctaTexto}</p>
        <a href={COPY.resultado.instagram} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5">
          {COPY.resultado.ctaBotao} <span aria-hidden="true">→</span>
        </a>
      </section>
    </div>
  );
}
