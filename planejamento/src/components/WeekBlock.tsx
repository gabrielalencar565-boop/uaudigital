import type { Plano, PlanoMeta } from "@/lib/plano";
import { rotuloDoPost } from "@/lib/datas";
import { promptDoPost } from "@/lib/promptRoteiro";
import PostCard from "./PostCard";

export default function WeekBlock({ semana, plano, meta }: { semana: Plano["semanas"][number]; plano: Plano; meta: PlanoMeta }) {
  return (
    <section aria-labelledby={`semana-${semana.numero}`}>
      <p className="eyebrow">Semana {semana.numero}</p>
      <h3 id={`semana-${semana.numero}`} className="title mt-2 text-[1.75rem]">
        <b>{semana.foco}</b>
      </h3>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {semana.posts.map((p, i) => (
          <PostCard key={i} post={p} rotulo={rotuloDoPost(meta.mes, semana.numero, p)} prompt={promptDoPost(p, plano, meta, semana.numero)} />
        ))}
      </div>
    </section>
  );
}
