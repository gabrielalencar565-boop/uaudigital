"use client";

import type { FormEvent, ReactNode } from "react";

type Props = {
  etapa: number; // 0..4
  total?: number;
  titulo: string;
  emoji: string;
  pergunta?: string;
  onVoltar: () => void;
  onAvancar: () => void;
  cta?: string;
  children: ReactNode;
  /** Mantido por compatibilidade; o visual é o mesmo em todas as etapas. */
  roxo?: boolean;
  enviando?: boolean;
};

export default function StepShell({ etapa, total = 5, titulo, emoji, pergunta, onVoltar, onAvancar, cta = "Continuar", children, enviando }: Props) {
  const progresso = ((etapa + 1) / total) * 100;
  function enviar(e: FormEvent) {
    e.preventDefault();
    onAvancar();
  }
  return (
    <form noValidate onSubmit={enviar} className="flex min-h-dvh flex-col pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-10 -mx-5 bg-bg/90 px-5 pt-3 pb-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onVoltar}
            className="-ml-2 inline-flex min-h-12 items-center gap-1.5 rounded-xl px-2 text-[15px] font-medium text-muted transition-colors hover:text-fg"
          >
            <span aria-hidden="true">←</span> Voltar
          </button>
          <span className="text-sm font-medium text-dim tabular-nums">
            Etapa {etapa + 1} de {total}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Progresso do formulário"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={etapa + 1}
        >
          <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progresso}%`, background: "var(--grad)" }} />
        </div>
      </div>

      <p className="eyebrow mt-5">
        {String(etapa + 1).padStart(2, "0")} · {titulo} <span aria-hidden="true">{emoji}</span>
      </p>
      {pergunta ? (
        <h1 data-autofocus tabIndex={-1} className="mt-4 text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">
          {pergunta}
        </h1>
      ) : null}

      <div className="mt-7 flex flex-1 flex-col gap-6">{children}</div>

      <button type="submit" className="btn-main mt-8" disabled={enviando}>
        {cta} <span className="arr" aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
