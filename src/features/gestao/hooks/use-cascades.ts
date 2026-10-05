import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computePlan, type CascadePlan, type CascadeStep } from "../lib/cascade";

const sb = supabase as any;

export type Cascade = {
  id: string;
  name: string;
  steps: CascadeStep[];
  business_days: boolean;
  push_on_delay: boolean;
  is_default: boolean;
};

export type TaskPlan = {
  root_task_id: string;
  cascade_id: string | null;
  steps: CascadeStep[];
  plan: CascadePlan;
  original_plan: CascadePlan;
  business_days: boolean;
  push_on_delay: boolean;
};

export function useCascades() {
  return useQuery({
    queryKey: ["flow_cascades"],
    queryFn: async (): Promise<Cascade[]> => {
      const { data, error } = await sb.from("flow_cascades").select("id, name, steps, business_days, push_on_delay, is_default").order("created_at");
      if (error) throw error;
      return (data ?? []) as Cascade[];
    },
  });
}

export async function fetchTaskPlan(rootTaskId: string): Promise<TaskPlan | null> {
  const { data, error } = await sb.from("pm_task_plans").select("*").eq("root_task_id", rootTaskId).maybeSingle();
  if (error) throw error;
  return (data as TaskPlan | null) ?? null;
}

// The plan belongs to the first task of a piece of work; every later stage task points to it via origin_task_id.
export function useTaskPlan(rootTaskId: string | null | undefined) {
  return useQuery({
    enabled: !!rootTaskId,
    queryKey: ["pm_task_plan", rootTaskId],
    queryFn: () => fetchTaskPlan(rootTaskId!),
  });
}

export async function createTaskPlan(rootTaskId: string, cascade: Cascade, startDate: string) {
  const plan = computePlan(cascade.steps, startDate, cascade.business_days);
  const { error } = await sb.from("pm_task_plans").insert({
    root_task_id: rootTaskId,
    cascade_id: cascade.id,
    steps: cascade.steps,
    plan,
    original_plan: plan,
    business_days: cascade.business_days,
    push_on_delay: cascade.push_on_delay,
  });
  if (error) throw error;
  return plan;
}

export async function saveTaskPlan(rootTaskId: string, plan: CascadePlan) {
  const { error } = await sb.from("pm_task_plans").update({ plan, updated_at: new Date().toISOString() }).eq("root_task_id", rootTaskId);
  if (error) throw error;
}
