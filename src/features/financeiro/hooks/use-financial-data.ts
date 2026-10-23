import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_EXCLUDED_CATEGORIES } from "../utils/client-margin";

// ── Types ──
export type FinClient = {
  id: string;
  name: string;
  cnpj: string | null;
  monthly_value: number;
  contract_months: number;
  contract_start: string;
  due_day: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  paused_from: string | null;
  resumed_from: string | null;
  ended_at: string | null;
};

export type FinRevenue = {
  id: string;
  client_id: string;
  year: number;
  month: number;
  amount: number;
  status: string;
  paid_at: string | null;
  notes: string | null;
};

export type FinExpense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  year: number;
  month: number;
  status: string;
  is_recurring: boolean;
  installment_total: number | null;
  installment_current: number | null;
  credit_card_id: string | null;
  paid_at: string | null;
  notes: string | null;
  due_day: number | null;
  /** liga as versões de uma despesa recorrente reajustada (a 1ª versão usa o próprio id) */
  series_id?: string | null;
  /** recorrente cadastrada com "vale a partir de": não aparece nos meses antes do mês dela */
  starts_at_month?: boolean;
  /** só nas cópias calculadas: ano/mês da linha que de fato vale naquele mês (onde ela está gravada) */
  anchor_year?: number;
  anchor_month?: number;
};

export type FinCreditCard = {
  id: string;
  name: string;
  last_digits: string | null;
  closing_day: number;
  due_day: number;
  is_active: boolean;
};

export type FinTransaction = {
  id: string;
  type: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  status: string;
  source: string;
  notes: string | null;
  created_at: string;
};

export type FinGoal = {
  id: string;
  year: number;
  month: number | null;
  revenue_goal: number;
  expense_limit: number;
  notes: string | null;
};

// ── Query keys ──
const FK = {
  clients: ["fin-clients"] as const,
  revenues: (y: number, m: number) => ["fin-revenues", y, m] as const,
  expenses: (y: number, m: number) => ["fin-expenses", y, m] as const,
  cards: ["fin-cards"] as const,
  transactions: (y: number, m: number) => ["fin-transactions", y, m] as const,
  goals: (y: number) => ["fin-goals", y] as const,
};

// ── Clients ──
export function useFinClients() {
  return useQuery({
    queryKey: FK.clients,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_clients" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as FinClient[];
    },
  });
}

export function useUpsertFinClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client: Partial<FinClient> & { name: string }) => {
      if (client.id) {
        const { error } = await supabase
          .from("financial_clients" as any)
          .update(client as any)
          .eq("id", client.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financial_clients" as any)
          .insert(client as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FK.clients });
      toast.success("Cliente salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteFinClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_clients" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FK.clients });
      toast.success("Cliente excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Revenues ──
export function useFinRevenues(year: number, month: number) {
  return useQuery({
    queryKey: FK.revenues(year, month),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_revenues" as any)
        .select("*")
        .eq("year", year)
        .eq("month", month);
      if (error) throw error;
      return (data ?? []) as unknown as FinRevenue[];
    },
  });
}

/** Completed stages per client and stage type in a month (fin_client_workload); the weights are applied on screen. */
export function useFinClientWorkload(year: number, month: number) {
  return useQuery({
    queryKey: ["fin_client_workload", year, month],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fin_client_workload", { p_year: year, p_month: month });
      if (error) throw error;
      return ((data ?? []) as { client_id: string; stage: string; stages: number }[]).map((r) => ({ ...r, stages: Number(r.stages) }));
    },
  });
}

/** Same for a whole year, grouped by month. */
export function useFinClientWorkloadYear(year: number) {
  return useQuery({
    queryKey: ["fin_client_workload_year", year],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fin_client_workload_year", { p_year: year });
      if (error) throw error;
      const byMonth = new Map<number, { client_id: string; stage: string; stages: number }[]>();
      for (const r of (data ?? []) as { client_id: string; month: number; stage: string; stages: number }[]) {
        const list = byMonth.get(r.month) ?? [];
        list.push({ client_id: r.client_id, stage: r.stage, stages: Number(r.stages) });
        byMonth.set(r.month, list);
      }
      return byMonth;
    },
  });
}

export type FinMarginSettings = { agency_id: string | null; stage_weights: Record<string, number>; excluded_categories: string[] };

/** How the margin per client is calculated for this agency (stage weights, expense categories left out of the split). */
export function useFinMarginSettings() {
  return useQuery({
    queryKey: ["fin_margin_settings"],
    queryFn: async (): Promise<FinMarginSettings> => {
      const { data, error } = await (supabase as any).from("fin_margin_settings").select("agency_id, stage_weights, excluded_categories").maybeSingle();
      if (error) throw error;
      return {
        agency_id: data?.agency_id ?? null,
        stage_weights: (data?.stage_weights ?? {}) as Record<string, number>,
        excluded_categories: (data?.excluded_categories ?? DEFAULT_EXCLUDED_CATEGORIES) as string[],
      };
    },
  });
}

export function useSaveFinMarginSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { existingAgencyId: string | null; stage_weights: Record<string, number>; excluded_categories: string[] }) => {
      const db = supabase as any;
      const payload = { stage_weights: v.stage_weights, excluded_categories: v.excluded_categories, updated_at: new Date().toISOString() };
      const { error } = v.existingAgencyId
        ? await db.from("fin_margin_settings").update(payload).eq("agency_id", v.existingAgencyId)
        : await db.from("fin_margin_settings").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin_margin_settings"] });
      toast.success("Cálculo da margem atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
  });
}

export function useUpsertFinRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rev: Partial<FinRevenue> & { client_id: string; year: number; month: number }) => {
      if (rev.id) {
        const { error } = await supabase.from("financial_revenues" as any).update(rev as any).eq("id", rev.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_revenues" as any).insert(rev as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: FK.revenues(v.year, v.month) });
      toast.success("Receita salva");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Expenses ──
export function useFinExpenses(year: number, month: number) {
  return useQuery({
    queryKey: FK.expenses(year, month),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_expenses" as any)
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .order("category");
      if (error) throw error;
      return (data ?? []) as unknown as FinExpense[];
    },
  });
}

export function useUpsertFinExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (exp: Partial<FinExpense> & { description: string; category: string; year: number; month: number }) => {
      if (exp.id) {
        const { error } = await supabase.from("financial_expenses" as any).update(exp as any).eq("id", exp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_expenses" as any).insert(exp as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: FK.expenses(v.year, v.month) });
      qc.invalidateQueries({ queryKey: ["fin-expenses-year", v.year] });
      toast.success("Despesa salva");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

const RECURRING_VALUE_KEYS = ["amount", "description", "category", "due_day", "credit_card_id", "notes"] as const;

/**
 * Salva uma mudança numa despesa RECORRENTE sem mexer nos meses anteriores ("a partir deste mês"):
 * - se a versão que vale hoje começa antes do mês aberto → nasce uma nova versão neste mês;
 * - se ela começa neste mesmo mês → atualiza no lugar (e, se mudou valor e não havia versão antes, guarda o valor antigo nos meses de antes);
 * - se o mês aberto vem antes de onde ela começa → a linha passa a começar neste mês.
 * `original` é a linha mostrada (pode ser a cópia calculada, com anchor_year/anchor_month).
 */
export function useSaveRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ original, changes, year, month }: { original: FinExpense; changes: Partial<FinExpense>; year: number; month: number }) => {
      const db = supabase as any;
      const T = "financial_expenses";
      const anchorYear = original.anchor_year ?? original.year;
      const anchorMonth = original.anchor_month ?? original.month;
      const anchorIdx = anchorYear * 12 + (anchorMonth - 1);
      const viewIdx = year * 12 + (month - 1);
      const seriesId = original.series_id ?? original.id;
      const base = {
        description: original.description, category: original.category, amount: original.amount, credit_card_id: original.credit_card_id,
        notes: original.notes, due_day: original.due_day, is_recurring: true, installment_total: null, installment_current: null, series_id: seriesId,
      };
      const ensureSeries = async () => {
        if (!original.series_id) { const { error } = await db.from(T).update({ series_id: seriesId }).eq("id", original.id); if (error) throw error; }
      };

      if (anchorIdx < viewIdx) {
        await ensureSeries();
        const { error } = await db.from(T).insert({ ...base, status: "pendente", paid_at: null, ...changes, year, month });
        if (error) throw error;
      } else if (anchorIdx === viewIdx) {
        const valueChanged = RECURRING_VALUE_KEYS.some((k) => changes[k] !== undefined && String(changes[k] ?? "") !== String((original as any)[k] ?? ""));
        // recorrente que só começa neste mês não precisa guardar valor antigo para os meses de antes
        if (valueChanged && month > 1 && !original.starts_at_month) {
          const { data: sibs, error: e1 } = await db.from(T).select("id, month").eq("year", year).or(`series_id.eq.${seriesId},id.eq.${seriesId}`);
          if (e1) throw e1;
          if (!(sibs ?? []).some((r: any) => r.month < month)) {
            const { error } = await db.from(T).insert({ ...base, status: "pendente", paid_at: null, year, month: 1 });
            if (error) throw error;
          }
        }
        const { error } = await db.from(T).update({ ...changes, series_id: seriesId }).eq("id", original.id);
        if (error) throw error;
      } else {
        const { error } = await db.from(T).update({ ...changes, series_id: seriesId, year, month }).eq("id", original.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["fin-expenses"] });
      qc.invalidateQueries({ queryKey: ["fin-expenses-year", v.year] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteFinExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, year, month }: { id: string; year: number; month: number }) => {
      const { error } = await supabase.from("financial_expenses" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: FK.expenses(v.year, v.month) });
      qc.invalidateQueries({ queryKey: ["fin-expenses-year", v.year] });
      toast.success("Despesa excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Credit Cards ──
export function useFinCreditCards() {
  return useQuery({
    queryKey: FK.cards,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_credit_cards" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as FinCreditCard[];
    },
  });
}

export function useUpsertFinCreditCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (card: Partial<FinCreditCard> & { name: string }) => {
      if (card.id) {
        const { error } = await supabase.from("financial_credit_cards" as any).update(card as any).eq("id", card.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_credit_cards" as any).insert(card as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FK.cards });
      toast.success("Cartão salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Transactions ──
export function useFinTransactions(year: number, month: number) {
  return useQuery({
    queryKey: FK.transactions(year, month),
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("financial_transactions" as any)
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FinTransaction[];
    },
  });
}

export function useUpsertFinTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: Partial<FinTransaction> & { description: string; amount: number; date: string; type: string }) => {
      if (tx.id) {
        const { error } = await supabase.from("financial_transactions" as any).update(tx as any).eq("id", tx.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_transactions" as any).insert(tx as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-transactions"] });
      toast.success("Lançamento salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteFinTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-transactions"] });
      toast.success("Lançamento excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useBulkInsertTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (txs: Array<{ description: string; amount: number; date: string; type: string; source: string; category?: string | null }>) => {
      const { error } = await supabase.from("financial_transactions" as any).insert(txs as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-transactions"] });
      toast.success("Lançamentos importados");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Goals ──
export function useFinGoals(year: number) {
  return useQuery({
    queryKey: FK.goals(year),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_goals" as any)
        .select("*")
        .eq("year", year)
        .order("month");
      if (error) throw error;
      return (data ?? []) as unknown as FinGoal[];
    },
  });
}

export function useUpsertFinGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Partial<FinGoal> & { year: number }) => {
      if (goal.id) {
        const { error } = await supabase.from("financial_goals" as any).update(goal as any).eq("id", goal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_goals" as any).insert(goal as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: FK.goals(v.year) });
      toast.success("Meta salva");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── MRR Movements ──
export type MrrMovement = {
  id: string;
  year: number;
  month: number;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export function useMrrMovements(year: number) {
  return useQuery({
    queryKey: ["mrr-movements", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mrr_movements" as any)
        .select("*")
        .eq("year", year)
        .order("month")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as MrrMovement[];
    },
  });
}

export function useUpsertMrrMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mov: Partial<MrrMovement> & { year: number; month: number; type: string; amount: number }) => {
      if (mov.id) {
        const { error } = await supabase.from("mrr_movements" as any).update(mov as any).eq("id", mov.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mrr_movements" as any).insert(mov as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["mrr-movements", v.year] });
      toast.success("Movimentação salva");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteMrrMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, year }: { id: string; year: number }) => {
      const { error } = await supabase.from("mrr_movements" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["mrr-movements", v.year] });
      toast.success("Movimentação excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Aggregation helpers ──
export function useFinAllRevenues(year: number) {
  return useQuery({
    queryKey: ["fin-revenues-year", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_revenues" as any)
        .select("*")
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as unknown as FinRevenue[];
    },
  });
}

export function useFinAllExpenses(year: number) {
  return useQuery({
    queryKey: ["fin-expenses-year", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_expenses" as any)
        .select("*")
        // o ano todo + as parcelas de anos anteriores, que podem terminar neste ano (ver buildEffectiveExpenses)
        .or(`year.eq.${year},and(year.lt.${year},installment_total.not.is.null)`);
      if (error) throw error;
      return (data ?? []) as unknown as FinExpense[];
    },
  });
}

export function useFinAllTransactions(year: number) {
  return useQuery({
    queryKey: ["fin-transactions-year", year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const { data, error } = await supabase
        .from("financial_transactions" as any)
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");
      if (error) throw error;
      return (data ?? []) as unknown as FinTransaction[];
    },
  });
}

// ── Opening Balances ──
export type FinOpeningBalance = {
  id: string;
  year: number;
  month: number;
  amount: number;
};

export function useFinOpeningBalances(year: number) {
  return useQuery({
    queryKey: ["fin-opening-balances", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_opening_balances" as any)
        .select("*")
        .eq("year", year)
        .order("month");
      if (error) throw error;
      return (data ?? []) as unknown as FinOpeningBalance[];
    },
  });
}

export function useUpsertOpeningBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bal: { year: number; month: number; amount: number; id?: string }) => {
      if (bal.id) {
        const { error } = await supabase.from("financial_opening_balances" as any).update({ amount: bal.amount } as any).eq("id", bal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_opening_balances" as any).insert({ year: bal.year, month: bal.month, amount: bal.amount } as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["fin-opening-balances", v.year] });
      toast.success("Saldo inicial salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Already-categorized lines of the agency: what the statement import learns from (RLS keeps it to the agency).
export async function fetchCategorizationHistory(): Promise<Array<{ description: string; category: string | null; type: string }>> {
  const { data, error } = await supabase
    .from("financial_transactions" as any)
    .select("description, category, type")
    .not("category", "is", null)
    .order("date", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as unknown as Array<{ description: string; category: string | null; type: string }>;
}
