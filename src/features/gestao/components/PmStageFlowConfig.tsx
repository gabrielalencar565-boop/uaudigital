import { useState, useMemo } from "react";
import { ArrowRight, Check, Settings2, Plus, Trash2, Pencil, Save, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { PM_ACTIVE_STAGES, getStageCircleColor } from "../pm-constants";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const sb = supabase as any;

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

// stage_assignees format: { "stage_key": { "client_id": "user_id" | null } }
export type StageAssignees = Record<string, Record<string, string | null>>;

export interface StageFlow {
  id: string;
  name: string;
  flow_config: Record<string, string | string[]>;
  transition_dates?: Record<string, "pick" | number>;
  stage_assignees?: StageAssignees;
  is_default: boolean;
  created_by: string;
  created_at: string;
}

export function useStageFlows() {
  return useQuery<StageFlow[]>({
    queryKey: ["pm_stage_flows"],
    queryFn: async () => {
      const { data, error } = await sb.from("pm_stage_flows").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Get the default flow's config (backward compat) */
export function useDefaultFlow() {
  const flowsQ = useStageFlows();
  const defaultFlow = (flowsQ.data ?? []).find(f => f.is_default) ?? (flowsQ.data ?? [])[0];
  return defaultFlow?.flow_config ?? {};
}

/** Get the default flow's config AND transition dates AND stage assignees */
export function useDefaultFlowWithDates() {
  const flowsQ = useStageFlows();
  const defaultFlow = (flowsQ.data ?? []).find(f => f.is_default) ?? (flowsQ.data ?? [])[0];
  return {
    flowConfig: defaultFlow?.flow_config ?? {},
    transitionDates: (defaultFlow?.transition_dates ?? {}) as Record<string, "pick" | number>,
    stageAssignees: (defaultFlow?.stage_assignees ?? {}) as StageAssignees,
  };
}

/** Get next stage options for a given stage key from the default flow */
export function getNextStages(flowConfig: Record<string, string | string[]>, stageKey: string): string[] {
  const next = flowConfig[stageKey];
  if (!next) return [];
  if (Array.isArray(next)) return next;
  return [next];
}

/** Get the fixed assignee for a client+stage from the flow config */
export function getFixedAssignee(stageAssignees: StageAssignees, stageKey: string, clientId: string): string | null | undefined {
  const stageMap = stageAssignees[stageKey];
  if (!stageMap) return undefined; // no config for this stage
  if (clientId in stageMap) return stageMap[clientId]; // could be string (user_id) or null (no fixed)
  return undefined; // no config for this client in this stage
}

const STAGE_OPTIONS = PM_ACTIVE_STAGES;

const DATE_MODE_OPTIONS = [
  { value: "none", label: "Sem alteração de data" },
  { value: "pick", label: "Escolher data" },
  { value: "1", label: "+1 dia" },
  { value: "2", label: "+2 dias" },
  { value: "3", label: "+3 dias" },
  { value: "5", label: "+5 dias" },
  { value: "7", label: "+7 dias" },
];

export function PmStageFlowConfig() {
  const qc = useQueryClient();
  const flowsQ = useStageFlows();
  const flows = flowsQ.data ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editConfig, setEditConfig] = useState<Record<string, string[]>>({});
  const [editTransitionDates, setEditTransitionDates] = useState<Record<string, "pick" | number>>({});
  const [isCreating, setIsCreating] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async ({ id, name, flow_config, transition_dates }: { id?: string; name: string; flow_config: Record<string, string[]>; transition_dates: Record<string, "pick" | number> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const cleaned: Record<string, string | string[]> = {};
      Object.entries(flow_config).forEach(([k, v]) => {
        if (v.length === 1) cleaned[k] = v[0];
        else if (v.length > 1) cleaned[k] = v;
      });
      if (id) {
        const { error } = await sb.from("pm_stage_flows").update({ name, flow_config: cleaned, transition_dates, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("pm_stage_flows").insert({ name, flow_config: cleaned, transition_dates, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_stage_flows"] });
      setEditingId(null);
      setIsCreating(false);
      toast.success("Fluxo salvo com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar fluxo"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("pm_stage_flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_stage_flows"] });
      toast.success("Fluxo excluído");
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await sb.from("pm_stage_flows").update({ is_default: false }).neq("id", id);
      const { error } = await sb.from("pm_stage_flows").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_stage_flows"] });
      toast.success("Fluxo padrão definido");
    },
  });

  const normalizeConfig = (config: Record<string, string | string[]>): Record<string, string[]> => {
    const result: Record<string, string[]> = {};
    Object.entries(config).forEach(([k, v]) => {
      result[k] = Array.isArray(v) ? v : [v];
    });
    return result;
  };

  const startEdit = (flow: StageFlow) => {
    setEditingId(flow.id);
    setEditName(flow.name);
    setEditConfig(normalizeConfig(flow.flow_config));
    setEditTransitionDates(flow.transition_dates ?? {});
    
    setIsCreating(false);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditName("");
    const defaultConfig: Record<string, string[]> = {};
    const stages = STAGE_OPTIONS;
    for (let i = 0; i < stages.length - 1; i++) {
      defaultConfig[stages[i].key] = [stages[i + 1].key];
    }
    setEditConfig(defaultConfig);
    setEditTransitionDates({});
    
  };

  const cancelEdit = () => { setEditingId(null); setIsCreating(false); };

  const handleSave = () => {
    if (!editName.trim()) { toast.error("Nome é obrigatório"); return; }
    const cleaned: Record<string, string[]> = {};
    Object.entries(editConfig).forEach(([k, v]) => {
      if (v.length > 0) cleaned[k] = v;
    });
    saveMutation.mutate({ id: editingId ?? undefined, name: editName.trim(), flow_config: cleaned, transition_dates: editTransitionDates });
  };

  const toggleStageNext = (stageKey: string, nextKey: string) => {
    setEditConfig(prev => {
      const copy = { ...prev };
      const current = copy[stageKey] ?? [];
      if (current.includes(nextKey)) {
        copy[stageKey] = current.filter(k => k !== nextKey);
        if (copy[stageKey].length === 0) delete copy[stageKey];
      } else {
        copy[stageKey] = [...current, nextKey];
      }
      return copy;
    });
  };

  const setDateMode = (stageKey: string, mode: string) => {
    setEditTransitionDates(prev => {
      const copy = { ...prev };
      if (mode === "none") {
        delete copy[stageKey];
      } else if (mode === "pick") {
        copy[stageKey] = "pick";
      } else {
        copy[stageKey] = parseInt(mode);
      }
      return copy;
    });
  };

  const getDateModeValue = (stageKey: string): string => {
    const val = editTransitionDates[stageKey];
    if (val === undefined) return "none";
    if (val === "pick") return "pick";
    return String(val);
  };


  const isEditing = !!editingId || isCreating;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            Fluxos de Etapas
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure como as tarefas avançam entre etapas e datas de entrega.
          </p>
        </div>
        {!isEditing && (
          <Button size="sm" onClick={startCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo Fluxo
          </Button>
        )}
      </div>

      {/* Edit / Create form */}
      {isEditing && (
        <div className="border border-primary/30 rounded-lg p-5 bg-card/50 space-y-4">
          <div className="flex items-center gap-3">
            <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome do fluxo..." className="h-9 text-sm max-w-xs" />
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={cancelEdit} className="gap-1"><X className="h-4 w-4" /> Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1"><Save className="h-4 w-4" /> Salvar</Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Marque as próximas etapas e configure a data de entrega ao concluir.
          </p>

          <div className="border border-border/30 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[180px_1fr_160px] gap-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/20">
              <div className="px-4 py-2.5">Etapa Atual</div>
              <div className="px-4 py-2.5">Ao Concluir → Próximas</div>
              <div className="px-4 py-2.5">Data</div>
            </div>
            {STAGE_OPTIONS.map(stage => {
              const color = getStageCircleColor(stage.key);
              const isDone = stage.key === "entrega";
              const selectedNexts = editConfig[stage.key] ?? [];

              return (
                <div key={stage.key} className="grid grid-cols-[180px_1fr_160px] gap-0 border-b border-border/10 hover:bg-accent/20 transition">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", color.border, isDone && color.bg)}>
                      {isDone && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <span className="text-sm font-medium">{stage.label}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    {isDone ? (
                      <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Etapa Final
                      </span>
                    ) : (
                      STAGE_OPTIONS.filter(s => s.key !== stage.key).map(s => {
                        const sc = getStageCircleColor(s.key);
                        const isChecked = selectedNexts.includes(s.key);
                        return (
                          <label key={s.key} className={cn("flex items-center gap-1.5 cursor-pointer rounded-md border px-2 py-1 text-xs transition", isChecked ? "border-primary/40 bg-primary/10" : "border-border/30 hover:bg-accent/30")}>
                            <Checkbox checked={isChecked} onCheckedChange={() => toggleStageNext(stage.key, s.key)} className="h-3.5 w-3.5" />
                            <span className={cn("h-3 w-3 rounded-full border-2 shrink-0", sc.border, s.key === "entrega" && sc.bg)} />
                            <span>{s.label}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <div className="flex items-center px-4 py-2.5">
                    {!isDone && (
                      <Select value={getDateModeValue(stage.key)} onValueChange={(v) => setDateMode(stage.key, v)}>
                        <SelectTrigger className="h-7 text-xs w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_MODE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Flow list */}
      <div className="space-y-3">
        {flows.map(flow => {
          if (editingId === flow.id) return null;
          const config = flow.flow_config as Record<string, string | string[]>;
          const dates = (flow.transition_dates ?? {}) as Record<string, "pick" | number>;

          return (
            <div key={flow.id} className={cn("border rounded-lg p-5 transition", flow.is_default ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/30")}>
              <div className="flex items-center gap-3 mb-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  {flow.is_default && <Star className="h-4 w-4 text-primary fill-primary" />}
                  {flow.name}
                </h4>
                <div className="ml-auto flex gap-1">
                  {!flow.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => setDefaultMutation.mutate(flow.id)} className="gap-1 text-xs h-7">
                      <Star className="h-3 w-3" /> Definir Padrão
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => startEdit(flow)} className="gap-1 text-xs h-7">
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(flow.id)} className="gap-1 text-xs h-7 text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3" /> Excluir
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {STAGE_OPTIONS.map(stage => {
                  const raw = config[stage.key];
                  if (!raw) return null;
                  const nexts = Array.isArray(raw) ? raw : [raw];
                  const color = getStageCircleColor(stage.key);
                  const dateMode = dates[stage.key];
                  const dateModeLabel = dateMode === "pick" ? "📅 Escolher data" : typeof dateMode === "number" ? `⏱ +${dateMode} dia${dateMode > 1 ? "s" : ""}` : null;

                  return (
                    <div key={stage.key} className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 rounded-md border border-border/40 bg-card/50 px-2.5 py-1.5 text-xs">
                        <span className={cn("h-3.5 w-3.5 rounded-full border-2 shrink-0", color.border)} />
                        <span className="font-medium">{stage.label}</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {nexts.map(nextKey => {
                        const nc = getStageCircleColor(nextKey);
                        const nextLabel = STAGE_OPTIONS.find(s => s.key === nextKey)?.label ?? nextKey;
                        return (
                          <div key={nextKey} className="flex items-center gap-1.5 rounded-md border border-border/40 bg-card/50 px-2.5 py-1.5 text-xs">
                            <span className={cn("h-3.5 w-3.5 rounded-full border-2 shrink-0", nc.border, nextKey === "entrega" && nc.bg)} />
                            <span className="font-medium">{nextLabel}</span>
                          </div>
                        );
                      })}
                      {dateModeLabel && (
                        <span className="text-[10px] text-muted-foreground ml-1 bg-muted/50 rounded px-1.5 py-0.5">{dateModeLabel}</span>
                      )}
                      {nexts.length > 1 && (
                        <span className="text-[10px] text-muted-foreground ml-1">(escolha ao concluir)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {flows.length === 0 && !isCreating && (
          <p className="text-center py-8 text-sm text-muted-foreground">
            Nenhum fluxo configurado. Crie o primeiro fluxo para automatizar o avanço de etapas.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        💡 O fluxo ⭐ padrão é usado quando você clica "Concluído" ou "Alteração" dentro de uma tarefa.
      </p>
    </div>
  );
}
