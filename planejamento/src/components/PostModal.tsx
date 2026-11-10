"use client";

import { useEffect, useRef, useState } from "react";
import { FASES } from "@/data/fases";
import { FORMATOS } from "@/data/formulario";
import { copiarTexto } from "@/lib/copiar";
import type { Post } from "@/lib/plano";

type Props = {
  aberto: boolean;
  post?: Post;
  rotulo?: string;
  semana?: number;
  foco?: string;
  prompt?: string;
  /** "3 de 12" */
  posicao?: string;
  onFechar: () => void;
  onAnterior?: () => void;
  onProximo?: () => void;
};

/**
 * Janela por cima da página com tudo que importa do post: gancho, ideia, CTA,
 * por que ele existe e o prompt do roteiro (já visível, com botão de copiar).
 * No computador fica no centro; no celular sobe de baixo, como uma folha.
 */
export default function PostModal({ aberto, post, rotulo, semana, foco, prompt, posicao, onFechar, onAnterior, onProximo }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // O aviso de "copiado" vale só para o post em que foi dado.
  const [aviso, setAviso] = useState<{ prompt: string; estado: "ok" | "erro" } | null>(null);
  const copiado = aviso && aviso.prompt === prompt ? aviso.estado : null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  // Trocar de post volta o conteúdo pro topo.
  useEffect(() => {
    ref.current?.querySelector("[data-rolagem]")?.scrollTo({ top: 0 });
  }, [post]);

  // Setas do teclado navegam entre os posts.
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && onProximo) onProximo();
      if (e.key === "ArrowLeft" && onAnterior) onAnterior();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, onAnterior, onProximo]);

  async function copiar() {
    if (!prompt) return;
    const ok = await copiarTexto(prompt);
    setAviso({ prompt, estado: ok ? "ok" : "erro" });
    setTimeout(() => setAviso((a) => (a?.prompt === prompt ? null : a)), 3000);
  }

  const fase = post ? FASES[post.fase] : undefined;
  const formato = post ? FORMATOS.find((f) => f.id === post.formato) : undefined;

  return (
    <dialog
      ref={ref}
      onClose={onFechar}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
      aria-labelledby="post-modal-titulo"
      className="post-modal m-0 mt-auto h-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[28px] border border-line bg-bg2 p-0 text-fg sm:m-auto sm:max-h-[88dvh] sm:max-w-[640px] sm:rounded-[28px]"
    >
      {post && fase ? (
        <div className="flex max-h-[inherit] flex-col">
          <div className="h-1.5 w-full flex-none" style={{ background: fase.cor }} aria-hidden="true" />
          <header className="flex flex-none items-center justify-between gap-3 px-5 pt-4 pb-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {rotulo ? <span className="rounded-lg bg-bg3 px-2 py-1 text-xs font-bold tracking-wide">{rotulo}</span> : null}
              <span className="rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ background: fase.cor, color: fase.corTexto }}>
                {fase.nome}
              </span>
              <span className="text-xs font-medium text-dim">
                <span aria-hidden="true">{formato?.icone}</span> {formato?.curto}
              </span>
            </div>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="grid size-10 flex-none place-items-center rounded-full border border-line text-lg text-muted hover:text-fg"
            >
              ×
            </button>
          </header>

          <div data-rolagem className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
            {semana ? (
              <p className="text-xs font-semibold tracking-[0.14em] text-dim uppercase">
                Semana {semana}
                {foco ? ` · ${foco}` : ""}
              </p>
            ) : null}
            <h2 id="post-modal-titulo" className="mt-1.5 text-[1.45rem] leading-tight font-extrabold tracking-[-0.02em] text-balance">
              {post.gancho}
            </h2>

            <dl className="mt-4 flex flex-col gap-3.5">
              <div>
                <dt className="text-xs font-semibold tracking-[0.14em] text-lilac uppercase">Ideia</dt>
                <dd className="mt-1 leading-relaxed text-muted">{post.ideia}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-[0.14em] text-lilac uppercase">CTA</dt>
                <dd className="mt-1 leading-relaxed">{post.cta}</dd>
              </div>
              <div className="rounded-2xl border border-line bg-bg3/60 px-4 py-3">
                <dt className="text-xs font-semibold tracking-[0.14em] text-dim uppercase">Por que esse post existe</dt>
                <dd className="mt-1 leading-relaxed">
                  <span className="font-semibold" style={{ color: fase.cor }}>
                    {fase.nome}: {fase.funcao}.
                  </span>{" "}
                  {post.por_que}
                </dd>
              </div>
            </dl>

            {prompt ? (
              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs font-semibold tracking-[0.14em] text-lilac uppercase">Prompt do roteiro</p>
                  <p className="text-xs text-dim">Cola no ChatGPT ou no Claude</p>
                </div>
                <pre className="mt-2 max-h-56 overflow-auto rounded-2xl border border-line bg-bg p-3.5 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-muted select-all">
                  {prompt}
                </pre>
              </div>
            ) : null}
          </div>

          <footer className="flex flex-none flex-col gap-3 border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={copiar} className="btn-main">
              <span aria-hidden="true">✨</span> {copiado === "ok" ? "Prompt copiado!" : "Copiar prompt do roteiro"}
            </button>
            <p aria-live="polite" className="-mt-1 text-center text-sm text-dim empty:hidden">
              {copiado === "ok"
                ? "Agora é só colar no chat que ele devolve o roteiro pronto."
                : copiado === "erro"
                  ? "Não consegui copiar sozinho. Seleciona o texto do prompt e copia."
                  : ""}
            </p>
            {onAnterior || onProximo ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={onAnterior}
                  disabled={!onAnterior}
                  className="min-h-11 rounded-full px-3 font-semibold text-muted hover:text-fg disabled:opacity-30"
                >
                  ← Anterior
                </button>
                {posicao ? <span className="text-dim tabular-nums">{posicao}</span> : null}
                <button
                  type="button"
                  onClick={onProximo}
                  disabled={!onProximo}
                  className="min-h-11 rounded-full px-3 font-semibold text-muted hover:text-fg disabled:opacity-30"
                >
                  Próximo →
                </button>
              </div>
            ) : null}
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}
