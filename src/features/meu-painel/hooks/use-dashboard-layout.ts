import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

const sb = supabase as any;

export type BlockWidth = "full" | "half" | "third";

export const DASHBOARD_BLOCKS = [
  { key: "metrics", label: "Métricas do mês", description: "Tarefas, concluídas, pendentes e atrasadas do mês", defaultWidth: "full" as BlockWidth },
  { key: "tasks", label: "Atribuídas a mim", description: "Suas tarefas atribuídas, organizadas por prazo", defaultWidth: "half" as BlockWidth },
  { key: "instagram", label: "Publicações no Instagram", description: "O que vai ao ar hoje no Instagram", defaultWidth: "half" as BlockWidth },
  { key: "notes", label: "Notas", description: "Suas anotações pessoais da semana", defaultWidth: "full" as BlockWidth },
  { key: "productivity_breakdown", label: "Sua produtividade", description: "Gráfico de entregas e distribuição por tipo", defaultWidth: "full" as BlockWidth },
] as const;

export type DashboardBlockKey = (typeof DASHBOARD_BLOCKS)[number]["key"];

export const DEFAULT_BLOCK_ORDER: DashboardBlockKey[] = DASHBOARD_BLOCKS.map((b) => b.key);
export const DEFAULT_WIDTHS: Record<DashboardBlockKey, BlockWidth> = Object.fromEntries(
  DASHBOARD_BLOCKS.map((b) => [b.key, b.defaultWidth]),
) as Record<DashboardBlockKey, BlockWidth>;

const VALID_WIDTHS: BlockWidth[] = ["full", "half", "third"];

interface StoredLayout {
  order?: unknown;
  hidden?: unknown;
  widths?: unknown;
}

function sanitizeLayout(raw: StoredLayout | null | undefined): {
  order: DashboardBlockKey[];
  hidden: Set<DashboardBlockKey>;
  widths: Record<DashboardBlockKey, BlockWidth>;
} {
  const storedOrder = Array.isArray(raw?.order) ? (raw!.order as unknown[]) : [];
  const storedHidden = Array.isArray(raw?.hidden) ? (raw!.hidden as unknown[]) : [];
  // `widths` só existe em layouts salvos depois que o recurso de "lado a lado" foi criado —
  // null/undefined (layout antigo, ou nunca customizado) cai no padrão de cada bloco; um
  // objeto vazio explícito ({}) é respeitado (usuário deixou tudo em largura total).
  const storedWidths = raw?.widths && typeof raw.widths === "object" ? (raw!.widths as Record<string, unknown>) : null;

  const order = storedOrder.filter((k): k is DashboardBlockKey => DEFAULT_BLOCK_ORDER.includes(k as DashboardBlockKey));
  // garante que blocos novos (adicionados depois que o usuário já salvou um layout) apareçam no fim, visíveis
  for (const k of DEFAULT_BLOCK_ORDER) if (!order.includes(k)) order.push(k);

  const hidden = new Set(storedHidden.filter((k): k is DashboardBlockKey => DEFAULT_BLOCK_ORDER.includes(k as DashboardBlockKey)));

  const widths = { ...DEFAULT_WIDTHS };
  if (storedWidths) {
    for (const k of DEFAULT_BLOCK_ORDER) {
      const v = storedWidths[k];
      widths[k] = typeof v === "string" && VALID_WIDTHS.includes(v as BlockWidth) ? (v as BlockWidth) : "full";
    }
  }

  return { order, hidden, widths };
}

export function useMyDashboardLayout() {
  const { user } = useSession();

  const query = useQuery({
    queryKey: ["my_dashboard_layout", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sb
        .from("profiles")
        .select("dashboard_layout")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return sanitizeLayout(data?.dashboard_layout ?? null);
    },
  });

  const order = query.data?.order ?? DEFAULT_BLOCK_ORDER;
  const hidden = query.data?.hidden ?? new Set<DashboardBlockKey>();
  const widths = query.data?.widths ?? DEFAULT_WIDTHS;
  const visibleOrder = order.filter((k) => !hidden.has(k));

  return { order, hidden, widths, visibleOrder, isLoading: query.isLoading };
}

export function useUpdateMyDashboardLayout() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (layout: {
      order: DashboardBlockKey[];
      hidden: DashboardBlockKey[];
      widths: Partial<Record<DashboardBlockKey, BlockWidth>>;
    }) => {
      if (!user?.id) return;
      const { error } = await sb
        .from("profiles")
        .update({ dashboard_layout: layout })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_dashboard_layout", user?.id] });
    },
  });
}
