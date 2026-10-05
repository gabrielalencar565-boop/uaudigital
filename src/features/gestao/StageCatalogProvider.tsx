import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyStageCatalog, type FlowStageRow } from "./pm-constants";

export function useFlowStages() {
  return useQuery({
    queryKey: ["flow_stages"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<FlowStageRow[]> => {
      const { data, error } = await (supabase as any)
        .from("flow_stages")
        .select("key, label, color, kind, is_system, active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as FlowStageRow[];
    },
  });
}

// Loads the agency's stage catalog and applies it to the shared stage lists before the app renders; when it
// changes (an owner edited the flow) the subtree remounts so every screen picks up the new stages.
// If the catalog can't be loaded the built-in pipeline is used, so the app never depends on it to work.
export function StageCatalogProvider({ children }: { children: ReactNode }) {
  const q = useFlowStages();
  const [version, setVersion] = useState(0);
  const applied = useRef<string | null>(null);

  const settled = !q.isLoading;
  const signature = !settled ? null : q.isError ? "error" : JSON.stringify(q.data ?? []);
  if (signature !== null && applied.current !== signature) {
    applyStageCatalog(q.isError ? null : q.data ?? null);
  }
  useEffect(() => {
    if (signature === null) return;
    if (applied.current !== null && applied.current !== signature) setVersion((v) => v + 1);
    applied.current = signature;
  }, [signature]);

  if (signature === null) return null;
  return <Fragment key={version}>{children}</Fragment>;
}
