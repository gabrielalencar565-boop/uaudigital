"use client";

import { useEffect, useState } from "react";
import { COPY } from "@/data/textos";

export default function Generating() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, COPY.gerando.length - 1)), 2000);
    return () => clearInterval(t);
  }, []);
  const progresso = ((i + 1) / COPY.gerando.length) * 100;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center py-10 text-center">
      <div className="flex gap-2" aria-hidden="true">
        {[0, 1, 2].map((n) => (
          <span key={n} className="dot size-3.5 rounded-full" style={{ animationDelay: `${n * 160}ms`, background: "var(--grad)" }} />
        ))}
      </div>
      <h1 data-autofocus tabIndex={-1} className="title mt-8 text-[2.2rem]">
        Montando o mês <b className="grad-text">do seu cliente</b> 🗓️
      </h1>
      <p aria-live="polite" aria-atomic="true" className="mt-4 min-h-7 text-lg text-muted">
        {COPY.gerando[i]}
      </p>
      <div className="mt-8 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${progresso}%`, background: "var(--grad)" }} />
      </div>
      <p className="mt-6 text-sm text-dim">Isso leva uns 20 a 40 segundos. Não fecha a página.</p>
    </div>
  );
}
