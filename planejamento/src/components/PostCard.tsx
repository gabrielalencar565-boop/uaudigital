"use client";

import { useId, useState } from "react";
import { FASES } from "@/data/fases";
import { FORMATOS } from "@/data/formulario";
import type { Post } from "@/lib/plano";
import { copiarTexto } from "@/lib/copiar";
import PhaseChip from "./PhaseChip";

export default function PostCard({ post, prompt, rotulo }: { post: Post; prompt: string; rotulo?: string }) {
  const [aberto, setAberto] = useState(false);
  const [verPrompt, setVerPrompt] = useState(false);
  const [copiado, setCopiado] = useState<"ok" | "erro" | null>(null);
  const id = useId();
  const formato = FORMATOS.find((f) => f.id === post.formato);

  async function copiarPrompt() {
    const ok = await copiarTexto(prompt);
    setCopiado(ok ? "ok" : "erro");
    if (!ok) setVerPrompt(true);
    setTimeout(() => setCopiado(null), 3000);
  }

  return (
    <article className="overflow-hidden rounded-[20px] border border-line bg-bg2" style={{ borderLeft: `4px solid ${FASES[post.fase].cor}` }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={id}
        className="block w-full p-4 pb-3 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-bg3 px-2 py-1 text-xs font-bold tracking-wide text-fg">{rotulo ?? post.dia}</span>
          <PhaseChip fase={post.fase} />
          <span className="text-xs font-medium text-dim">
            <span aria-hidden="true">{formato?.icone}</span> {formato?.curto}
          </span>
        </div>
        <h4 className="mt-3 text-lg leading-snug font-bold tracking-[-0.01em]">{post.gancho}</h4>
        <p className="mt-2 leading-relaxed text-muted">{post.ideia}</p>
        <p className="mt-3 text-[15px]">
          <span className="font-semibold text-lilac">CTA:</span> {post.cta}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-dim">
          {aberto ? "Esconder" : "Por que esse post existe"} <span aria-hidden="true">{aberto ? "↑" : "↓"}</span>
        </span>
      </button>
      <div id={id} hidden={!aberto} className="border-t border-line px-4 pt-3 pb-1">
        <p className="text-xs font-semibold tracking-[0.14em] text-dim uppercase">Por que esse post existe</p>
        <p className="mt-1 leading-relaxed">{post.por_que}</p>
      </div>

      <div className="px-4 pt-2 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copiarPrompt}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
            style={{ background: "var(--grad)" }}
          >
            <span aria-hidden="true">✨</span> {copiado === "ok" ? "Prompt copiado!" : "Copiar prompt do roteiro"}
          </button>
          <button
            type="button"
            onClick={() => setVerPrompt((v) => !v)}
            aria-expanded={verPrompt}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-muted hover:text-fg"
          >
            {verPrompt ? "Esconder prompt" : "Ver prompt"}
          </button>
        </div>
        <p aria-live="polite" className="mt-2 text-sm text-dim empty:hidden">
          {copiado === "ok"
            ? "Cola no ChatGPT ou no Claude que ele te devolve o roteiro pronto."
            : copiado === "erro"
              ? "Não consegui copiar automaticamente. Seleciona o texto abaixo e copia."
              : ""}
        </p>
        {verPrompt ? (
          <pre className="mt-3 max-h-72 overflow-auto rounded-2xl border border-line bg-bg p-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-muted select-all">
            {prompt}
          </pre>
        ) : null}
      </div>
    </article>
  );
}
