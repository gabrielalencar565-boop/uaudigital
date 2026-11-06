import type { Plano } from "@/lib/plano";
import PostCard from "./PostCard";

export default function WeekBlock({ semana }: { semana: Plano["semanas"][number] }) {
  return (
    <section aria-labelledby={`semana-${semana.numero}`}>
      <h3 id={`semana-${semana.numero}`} className="title text-2xl">
        Semana {semana.numero} <span className="font-medium text-muted">· {semana.foco}</span>
      </h3>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {semana.posts.map((p, i) => (
          <PostCard key={i} post={p} />
        ))}
      </div>
    </section>
  );
}
