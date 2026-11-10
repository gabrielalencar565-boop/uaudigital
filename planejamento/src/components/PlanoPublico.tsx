"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlanoSalvo } from "@/lib/plano";
import { lerPlano } from "@/lib/storage";
import PlanResult from "./PlanResult";

/** Mostra um planejamento salvo. Sem Supabase, procura no navegador de quem gerou. */
export default function PlanoPublico({ id, inicial }: { id: string; inicial: PlanoSalvo | null }) {
  const [salvo, setSalvo] = useState<PlanoSalvo | null>(inicial);
  const [procurou, setProcurou] = useState(!!inicial);

  useEffect(() => {
    if (inicial) return;
    setSalvo(lerPlano(id)); // eslint-disable-line react-hooks/set-state-in-effect
    setProcurou(true);
  }, [id, inicial]);

  return (
    <main className="min-h-dvh bg-bg text-white">
      <div className="mx-auto w-full max-w-[960px] px-5">
        {salvo ? (
          <PlanResult salvo={salvo} />
        ) : procurou ? (
          <div className="flex min-h-dvh flex-col items-center justify-center gap-5 text-center">
            <h1 className="title text-3xl">Não achamos esse planejamento 🤔</h1>
            <p className="max-w-sm text-muted">O link pode estar incompleto ou o planejamento foi gerado em outro aparelho.</p>
            <Link href="/" className="btn-main max-w-xs">
              Planejar o mês de um cliente
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
