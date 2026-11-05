// Dia D por ciclo. O dia padrão vem de Configurações → Agência → Dia D; um mês pode ter o seu próprio Dia D (exceção), por exemplo
// dezembro fechando dia 18. O ciclo de um mês termina no Dia D dele e começa um dia depois do Dia D do mês anterior.
// Estas funções são puras: recebem um "dayFor(ano, mês)" e devolvem as datas. Onde ainda se passa só um número (o dia padrão), tudo se comporta como antes.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiaDFor = (year: number, month: number) => number;
/** Um número (dia fixo, como antes) ou uma função que dá o Dia D de cada mês. */
export type DiaDInput = number | DiaDFor;

export interface DiaDOverride {
  year: number;
  month: number; // 1-12
  day: number;
  reason: string | null;
}

/** Dia D do mês (ano, mês 1-12). */
export function resolveDiaD(day: DiaDInput, year: number, month: number): number {
  return typeof day === "function" ? day(year, month) : day;
}

export function makeDiaDFor(base: number, overrides: DiaDOverride[]): DiaDFor {
  const map = new Map(overrides.map((o) => [`${o.year}-${o.month}`, o.day]));
  return (year, month) => {
    // meses fora de 1-12 (ex.: o "mês 0" ao voltar de janeiro) são normalizados
    const d = new Date(year, month - 1, 1);
    return map.get(`${d.getFullYear()}-${d.getMonth() + 1}`) ?? base;
  };
}

/** Mês do ciclo (o do Dia D) que contém a data: até o Dia D do mês é o próprio mês; depois, o seguinte. */
export function cycleMonthYear(now: Date, day: DiaDInput): { year: number; month: number } {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (now.getDate() <= resolveDiaD(day, y, m)) return { year: y, month: m };
  return m < 12 ? { year: y, month: m + 1 } : { year: y + 1, month: 1 };
}

/** Âncora do ciclo (dia 1 do mês em que ele termina) que contém a data. */
export function anchorForDate(d: Date, day: DiaDInput): Date {
  const { year, month } = cycleMonthYear(d, day);
  return new Date(year, month - 1, 1);
}

/** Último dia do ciclo (o Dia D do mês da âncora). */
export function cycleEnd(anchor: Date, day: DiaDInput): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth(), resolveDiaD(day, anchor.getFullYear(), anchor.getMonth() + 1));
}

/** Primeiro dia do ciclo: um dia depois do Dia D do mês anterior. */
export function cycleStart(anchor: Date, day: DiaDInput): Date {
  const prev = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  const prevD = resolveDiaD(day, prev.getFullYear(), prev.getMonth() + 1);
  return new Date(prev.getFullYear(), prev.getMonth(), prevD + 1);
}

// ───────────── dados ─────────────

export function useDiaDOverrides() {
  return useQuery({
    queryKey: ["dia_d_overrides"],
    queryFn: async (): Promise<DiaDOverride[]> => {
      const { data, error } = await (supabase as any).from("dia_d_overrides").select("year, month, day, reason").order("year").order("month");
      if (error) throw error;
      return (data ?? []) as DiaDOverride[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Resolve o Dia D de cada mês a partir do padrão da agência + exceções. Enquanto as exceções carregam, vale o padrão. */
export function useDiaDFor(base: number): { dayFor: DiaDFor; overrides: DiaDOverride[] } {
  const q = useDiaDOverrides();
  const overrides = q.data;
  return useMemo(() => {
    const list = overrides ?? [];
    return { dayFor: makeDiaDFor(base, list), overrides: list };
  }, [base, overrides]);
}

export interface SetDiaDOverrideInput {
  year: number;
  month: number;
  /** nulo remove a exceção (volta ao dia padrão) */
  day: number | null;
  reason?: string;
}

/** Define ou remove a exceção de um mês (só administrador). Calendários e ciclos do mês são acertados no banco. */
export function useSetDiaDOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetDiaDOverrideInput): Promise<{ day: number; moved: number; failed: number }> => {
      const { data, error } = await (supabase as any).rpc("set_dia_d_override", {
        p_year: input.year,
        p_month: input.month,
        p_day: input.day,
        p_reason: input.reason ?? null,
      });
      if (error) throw error;
      return data as { day: number; moved: number; failed: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dia_d_overrides"] });
      // ciclos e calendários do mês podem ter mudado de período
      qc.invalidateQueries({ queryKey: ["publication_calendars"] });
      qc.invalidateQueries({ queryKey: ["publication_calendars_cycle"] });
      qc.invalidateQueries({ queryKey: ["calendar_publications"] });
      qc.invalidateQueries({ queryKey: ["magic2"] });
    },
  });
}
