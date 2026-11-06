"use client";

import { useId, useState } from "react";
import { FASES } from "@/data/fases";
import { FORMATOS } from "@/data/formulario";
import type { Post } from "@/lib/plano";
import PhaseChip from "./PhaseChip";

export default function PostCard({ post }: { post: Post }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const formato = FORMATOS.find((f) => f.id === post.formato);
  return (
    <article className="overflow-hidden rounded-[20px] border border-borda bg-card" style={{ borderLeft: `5px solid ${FASES[post.fase].cor}` }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={id}
        className="block w-full p-4 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-ink px-2 py-1 text-xs font-extrabold tracking-wide text-white">{post.dia}</span>
          <PhaseChip fase={post.fase} />
          <span className="text-xs font-medium text-muted">
            <span aria-hidden="true">{formato?.icone}</span> {formato?.curto}
          </span>
        </div>
        <h4 className="mt-3 text-lg leading-snug font-extrabold tracking-[-0.01em]">{post.gancho}</h4>
        <p className="mt-2 leading-relaxed text-white/85">{post.ideia}</p>
        <p className="mt-3 text-[15px]">
          <span className="font-bold text-amarelo">CTA:</span> {post.cta}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-muted">
          {aberto ? "Esconder" : "Por que esse post existe"} <span aria-hidden="true">{aberto ? "↑" : "↓"}</span>
        </span>
      </button>
      <div id={id} hidden={!aberto} className="border-t border-borda px-4 pt-3 pb-4">
        <p className="text-xs font-extrabold tracking-[0.14em] text-muted uppercase">Por que esse post existe</p>
        <p className="mt-1 leading-relaxed">{post.por_que}</p>
      </div>
    </article>
  );
}
