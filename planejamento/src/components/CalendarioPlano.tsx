"use client";

import { Fragment, useMemo, useState } from "react";
import { FASES, FASES_LISTA } from "@/data/fases";
import { FORMATOS } from "@/data/formulario";
import { curta, DIAS_DA_SEMANA, gradeDoMes, postsDatados, type PostDatado } from "@/lib/datas";
import type { Plano, PlanoMeta } from "@/lib/plano";
import { promptDoPost } from "@/lib/promptRoteiro";
import PhaseChip from "./PhaseChip";
import PostModal from "./PostModal";

/**
 * O calendário do resultado, com duas abas:
 * - Calendário: mês de parede no computador e agenda vertical no celular;
 * - Estratégia: mapa da jornada (fases × semanas), que mostra por que cada post existe.
 * Tocar num post abre uma janela por cima da página com ideia, CTA, por que e o prompt do roteiro.
 */

type Aba = "calendario" | "estrategia";

const formatoCurto = (id: string) => FORMATOS.find((f) => f.id === id);
const rotulo = (p: PostDatado) => (p.data ? `${p.post.dia} ${curta(p.data)}` : p.post.dia);

export default function CalendarioPlano({ plano, meta }: { plano: Plano; meta: PlanoMeta }) {
  const posts = useMemo(() => postsDatados(plano, meta.mes), [plano, meta.mes]);
  const grade = useMemo(() => gradeDoMes(meta.mes), [meta.mes]);
  const [aba, setAba] = useState<Aba>("calendario");
  const [sel, setSel] = useState<number | null>(null);
  const atual = sel === null ? undefined : posts[sel];
  const mesNome = meta.mes.split(" de ")[0];

  return (
    <section aria-labelledby="calendario-titulo" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Calendário de {mesNome}</p>
          <h2 id="calendario-titulo" className="title mt-2 text-[2rem]">
            O mês <b>post a post</b>
          </h2>
        </div>
        <div role="tablist" aria-label="Visualização" className="inline-flex rounded-full border border-line bg-bg2 p-1">
          {(
            [
              ["calendario", "Calendário"],
              ["estrategia", "Estratégia"],
            ] as const
          ).map(([k, nome]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={aba === k}
              onClick={() => setAba(k)}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors ${aba === k ? "bg-bg3 text-fg" : "text-dim hover:text-fg"}`}
            >
              {nome}
            </button>
          ))}
        </div>
      </div>

      {aba === "calendario" ? (
        <>
          {/* Computador: mês de parede */}
          {grade ? (
            <div className="hidden rounded-3xl border border-line bg-bg2 p-4 md:block">
              <div className="grid grid-cols-7 gap-1.5">
                {DIAS_DA_SEMANA.map((d) => (
                  <div key={d} className="px-1 pb-1 text-[11px] font-semibold tracking-[0.12em] text-dim uppercase">
                    {d}
                  </div>
                ))}
                {grade.map((linha, s) => (
                  <Fragment key={s}>
                    <div className="col-span-7 flex items-baseline gap-2 px-1 pt-2.5 pb-0.5">
                      <span className="text-[15px] font-bold">Semana {s + 1}</span>
                      <span className="truncate text-[13px] text-dim">{plano.semanas[s]?.foco}</span>
                    </div>
                    {linha.map((d, i) => {
                      const doDia = posts.filter((p) => p.semana === s + 1 && p.data?.dia === d.dia && p.data?.mes === d.mes);
                      return (
                        <div
                          key={i}
                          className={`flex min-h-[104px] flex-col gap-1.5 rounded-2xl border p-2 ${d.foraDoMes ? "border-dashed border-line/70 opacity-60" : "border-line"} ${i >= 5 ? "bg-bg/60" : "bg-bg"}`}
                        >
                          <span className="text-xs font-medium text-dim tabular-nums">{d.foraDoMes ? curta(d) : d.dia}</span>
                          {doDia.map((p) => {
                            const f = FASES[p.post.fase];
                            const fmt = formatoCurto(p.post.formato);
                            return (
                              <button
                                key={p.indice}
                                type="button"
                                onClick={() => setSel(p.indice)}
                                aria-pressed={atual?.indice === p.indice}
                                aria-label={`${rotulo(p)}: ${p.post.gancho}`}
                                className={`flex flex-col gap-0.5 rounded-xl px-2 py-1.5 text-left text-[12.5px] leading-tight font-semibold transition-transform hover:-translate-y-px ${atual?.indice === p.indice ? "ring-2 ring-fg ring-offset-2 ring-offset-bg" : ""}`}
                                style={{ background: f.cor, color: f.corTexto }}
                              >
                                <span className="text-[10.5px] font-extrabold tracking-wide uppercase opacity-75">
                                  <span aria-hidden="true">{fmt?.icone}</span> {fmt?.curto}
                                </span>
                                <span className="line-clamp-4">{p.post.gancho}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
              <Legenda />
            </div>
          ) : null}

          {/* Celular (e mês não reconhecido): agenda semana a semana */}
          <div className={`flex flex-col gap-6 ${grade ? "md:hidden" : "hidden"}`}>
            {plano.semanas.map((s) => {
              const daSemana = posts.filter((p) => p.semana === s.numero);
              const ini = daSemana[0]?.data;
              const fim = daSemana[daSemana.length - 1]?.data;
              return (
                <div key={s.numero} className="flex flex-col gap-2.5">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-dim uppercase">
                      Semana {s.numero}
                      {ini && fim ? ` · ${curta(ini)} a ${curta(fim)}` : ""}
                    </p>
                    <h3 className="mt-0.5 text-lg leading-tight font-extrabold tracking-[-0.02em]">{s.foco}</h3>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-bg3" aria-hidden="true">
                      {daSemana.map((p) => (
                        <span key={p.indice} className="h-full flex-1" style={{ background: FASES[p.post.fase].cor }} />
                      ))}
                    </div>
                  </div>
                  {daSemana.map((p) => (
                      <button
                        key={p.indice}
                        type="button"
                        onClick={() => setSel(p.indice)}
                        className="grid grid-cols-[48px_1fr] items-center gap-3 rounded-[18px] border border-line bg-bg2 px-3 py-3 text-left"
                      >
                        <span className="text-center">
                          <b className="block text-2xl leading-none font-extrabold tracking-[-0.03em] tabular-nums">{p.data?.dia ?? ""}</b>
                          <span className="text-[11px] font-semibold tracking-[0.1em] text-dim uppercase">{p.post.dia}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block leading-snug font-semibold">{p.post.gancho}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-2">
                            <PhaseChip fase={p.post.fase} />
                            <span className="text-xs text-dim">
                              <span aria-hidden="true">{formatoCurto(p.post.formato)?.icone}</span> {formatoCurto(p.post.formato)?.curto}
                            </span>
                          </span>
                        </span>
                      </button>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="rounded-3xl border border-line bg-bg2 p-4">
            <div className="overflow-x-auto">
              <div className="grid min-w-[640px] grid-cols-[140px_repeat(4,minmax(0,1fr))]">
                <div className="px-2 pb-2 text-[11px] font-semibold tracking-[0.12em] text-dim uppercase">Fase</div>
                {plano.semanas.map((s) => (
                  <div key={s.numero} className="px-2 pb-2">
                    <span className="text-[11px] font-semibold tracking-[0.12em] text-dim uppercase">Semana {s.numero}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{s.foco}</span>
                  </div>
                ))}
                {FASES_LISTA.map((f) => (
                  <Fragment key={f.id}>
                    <div className="flex flex-col justify-center border-t border-line px-2 py-3">
                      <span className="text-sm font-semibold">{f.nome}</span>
                      <span className="text-xs text-dim">{f.funcao}</span>
                    </div>
                    {plano.semanas.map((s) => (
                      <div key={s.numero} className="flex min-h-14 flex-wrap content-center gap-1.5 border-t border-l border-line p-2">
                        {posts
                          .filter((p) => p.semana === s.numero && p.post.fase === f.id)
                          .map((p) => (
                            <button
                              key={p.indice}
                              type="button"
                              onClick={() => setSel(p.indice)}
                              aria-pressed={atual?.indice === p.indice}
                              title={p.post.gancho}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${atual?.indice === p.indice ? "ring-2 ring-fg ring-offset-2 ring-offset-bg2" : ""}`}
                              style={{ background: f.cor, color: f.corTexto }}
                            >
                              <span aria-hidden="true">{formatoCurto(p.post.formato)?.icone}</span> {rotulo(p)}
                            </button>
                          ))}
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              O mês segue a jornada: <b className="text-fg">começa fazendo o público se reconhecer</b> e{" "}
              <b className="text-fg">termina com prova social e recompensa</b>, quando a pessoa já confia e está pronta pra agir.
            </p>
          </div>
        </>
      )}

      <PostModal
        aberto={!!atual}
        post={atual?.post}
        rotulo={atual ? rotulo(atual) : undefined}
        semana={atual?.semana}
        foco={atual ? plano.semanas[atual.semana - 1]?.foco : undefined}
        prompt={atual ? promptDoPost(atual.post, plano, meta, atual.semana) : undefined}
        posicao={atual ? `${atual.indice + 1} de ${posts.length}` : undefined}
        onFechar={() => setSel(null)}
        onAnterior={atual && atual.indice > 0 ? () => setSel(atual.indice - 1) : undefined}
        onProximo={atual && atual.indice < posts.length - 1 ? () => setSel(atual.indice + 1) : undefined}
      />
    </section>
  );
}

function Legenda() {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-[13px] text-muted">
      {FASES_LISTA.map((f) => (
        <li key={f.id} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: f.cor }} />
          {f.nome}
        </li>
      ))}
    </ul>
  );
}
