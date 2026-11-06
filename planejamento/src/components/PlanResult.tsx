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
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") {
      setAviso("Na versão demo o PDF fica desligado. No site publicado, ele baixa pronto pra apresentar ao cliente.");
      return;
    }
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
    <div className="relative isolate flex flex-col gap-6 pt-5 pb-12">
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[520px] w-screen -translate-x-1/2 overflow-hidden">
        <div className="orb -top-40 -right-40 size-[440px] bg-purple" />
      </div>
      <header className="flex flex-col items-start gap-4">
        <Logo className="h-9" />
        <div>
          <p className="eyebrow">
            Planejamento de {meta.mes.split(" de ")[0]} · {meta.cliente}
          </p>
          <h1 data-autofocus tabIndex={-1} className="title mt-3 text-[2.5rem] sm:text-[3.25rem]">
            O mês de {meta.cliente} <b className="grad-text">tá planejado.</b> 🗓️
          </h1>
          <p className="mt-2 text-dim">{meta.nicho}</p>
          {acoes && process.env.NEXT_PUBLIC_DEMO_MODE !== "1" ? (
            <p className="mt-3 text-sm text-dim">
              🔗 Pra reabrir depois:{" "}
              <a href={withBase(`/p/${salvo.id}`)} className="font-semibold text-fg underline underline-offset-4">
                link deste planejamento
              </a>
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="on-light rounded-3xl bg-light p-6 text-ink lg:col-span-2">
          <p className="eyebrow">Objetivo do mês</p>
          <p className="mt-3 text-[1.3rem] leading-snug font-bold tracking-[-0.02em] lg:text-[1.6rem]">{plano.objetivo_mes}</p>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plano.metas.map((m) => (
              <li key={m.meta} className="rounded-2xl bg-ink p-4 text-fg">
                <p className="font-bold">{m.meta}</p>
                <p className="mt-1 text-[15px] text-muted">{m.indicador}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-muted">{COPY.resultado.metasAviso}</p>
        </section>

        <section className="rounded-3xl border border-line bg-bg2 p-6">
          <h2 className="title text-2xl">
            Para quem <b>estamos falando</b>
          </h2>
          <dl className="mt-4 flex flex-col gap-3">
            {[
              ["Perfil", plano.publico.perfil],
              ["Dor", plano.publico.dor],
              ["Desejo", plano.publico.desejo],
              ["Objeção principal", plano.publico.objecao_principal],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="text-xs font-semibold tracking-[0.16em] text-lilac uppercase">{t}</dt>
                <dd className="mt-0.5 leading-snug">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-3xl border border-line bg-bg2 p-6">
          <h2 className="title text-2xl">
            Tom <b>de voz</b>
          </h2>
          <p className="mt-3 leading-relaxed text-muted">{plano.tom_de_voz.descricao}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {plano.tom_de_voz.exemplos.map((e) => (
              <li key={e} className="rounded-2xl border border-line px-4 py-3 text-[15px] leading-snug">
                “{e}”
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="fases-titulo" className="rounded-3xl border border-line bg-bg2 p-6">
        <h2 id="fases-titulo" className="title text-2xl">
          As 6 fases <b>da jornada</b>
        </h2>
        <p className="mt-2 text-[15px] text-muted">
          Cada post tem um papel. Toca num post pra ver por que ele existe e copia o prompt pra gerar o roteiro no ChatGPT ou no Claude.
        </p>
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
          <WeekBlock key={s.numero} semana={s} plano={plano} meta={meta} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-bg2 p-6">
          <h2 className="title text-2xl">
            Stories <b>da semana</b>
          </h2>
          <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 leading-snug text-muted marker:text-lilac">
            {plano.stories_recorrentes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section className="grad-border rounded-3xl p-6">
          <h2 className="title text-2xl">
            Como apresentar <b>ao cliente</b>
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {plano.frases_para_apresentar.map((f) => (
              <li key={f} className="rounded-2xl bg-bg3 px-4 py-3 leading-snug">
                “{f}”
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={baixarPdf} disabled={baixando} className="btn-main sm:w-auto sm:flex-1 sm:px-6">
          <span aria-hidden="true">📄</span> {baixando ? "Gerando o PDF…" : COPY.resultado.pdf} {baixando ? null : <span className="arr" aria-hidden="true">↗</span>}
        </button>
        <button type="button" onClick={copiar} className="btn-ghost text-fg sm:w-auto sm:flex-1 sm:px-6">
          <span aria-hidden="true">📋</span> {COPY.resultado.copiar}
        </button>
      </div>
      {acoes ? (
        <div className="-mt-1 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={acoes.onGerarDeNovo} disabled={acoes.gerando} className="btn-ghost text-muted sm:flex-1">
            <span aria-hidden="true">🔄</span> {acoes.gerando ? "Gerando outra versão…" : COPY.resultado.gerarDeNovo}
          </button>
          <button type="button" onClick={acoes.onOutroCliente} disabled={acoes.gerando} className="btn-ghost text-muted sm:flex-1">
            <span aria-hidden="true">➕</span> {COPY.resultado.outroCliente}
          </button>
        </div>
      ) : null}
      <p aria-live="polite" className="text-center text-[15px] font-medium text-orange empty:hidden">
        {acoes?.erro ?? aviso}
      </p>

      <section className="rounded-3xl p-7 text-white" style={{ background: "var(--grad)" }}>
        <p className="title text-[2.1rem]">
          <b>{COPY.resultado.ctaTitulo}</b>
        </p>
        <p className="mt-3 text-[17px] leading-relaxed text-white/90">{COPY.resultado.ctaTexto}</p>
        <a href={COPY.resultado.instagram} target="_blank" rel="noopener noreferrer" className="btn-white mt-6">
          {COPY.resultado.ctaBotao} <span className="arr" aria-hidden="true">↗</span>
        </a>
      </section>
    </div>
  );
}
