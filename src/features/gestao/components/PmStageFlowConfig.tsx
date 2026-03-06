import { useState, useMemo } from "react";
import { ArrowRight, Check, Settings2, Plus, Trash2, Pencil, Save, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { PM_ACTIVE_STAGES, getStageCircleColor } from "../pm-constants";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const sb = supabase as any;

interface StageFlow {
  id: string;
  name: string;
  flow_config: Record<string, string>;
  is_default: boolean;
  created_by: string;
  created_at: string;
}

function useStageFlows() {
  return useQuery<StageFlow[]>({
    queryKey: ["pm_stage_flows"],
    queryFn: async () => {
      const { data, error } = await sb.from("pm_stage_flows").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

const STAGE_OPTIONS = PM_ACTIVE_STAGES;
const NONE_VALUE = "__none__";

export function PmStageFlowConfig() {
  const qc = useQueryClient();
  const flowsQ = useStageFlows();
  const flows = flowsQ.data ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async ({ id, name, flow_config }: { id?: string; name: string; flow_config: Record<string, string> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      if (id) {
        const { error } = await sb.from("pm_stage_flows").update({ name, flow_config, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("pm_stage_flows").insert({ name, flow_config, created_by: user.id });
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
      // Remove default from all, set on target
      await sb.from("pm_stage_flows").update({ is_default: false }).neq("id", id);
      const { error } = await sb.from("pm_stage_flows").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_stage_flows"] });
      toast.success("Fluxo padrão definido");
    },
  });

  const startEdit = (flow: StageFlow) => {
    setEditingId(flow.id);
    setEditName(flow.name);
    setEditConfig({ ...flow.flow_config });
    setIsCreating(false);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditName("");
    // Default config: linear flow
    const defaultConfig: Record<string, string> = {};
    const stages = STAGE_OPTIONS;
    for (let i = 0; i < stages.length - 1; i++) {
      defaultConfig[stages[i].key] = stages[i + 1].key;
    }
    setEditConfig(defaultConfig);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  const handleSave = () => {
    if (!editName.trim()) { toast.error("Nome é obrigatório"); return; }
    // Clean config: remove entries pointing to NONE
    const cleaned: Record<string, string> = {};
    Object.entries(editConfig).forEach(([k, v]) => {
      if (v && v !== NONE_VALUE) cleaned[k] = v;
    });
    saveMutation.mutate({ id: editingId ?? undefined, name: editName.trim(), flow_config: cleaned });
  };

  const updateStageNext = (stageKey: string, nextKey: string) => {
    setEditConfig(prev => {
      const copy = { ...prev };
      if (nextKey === NONE_VALUE) {
        delete copy[stageKey];
      } else {
        copy[stageKey] = nextKey;
      }
      return copy;
    });
  };

  const isEditing = !!editingId || isCreating;
  const currentEditConfig = isEditing ? editConfig : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            Fluxos de Etapas
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure como as tarefas avançam automaticamente entre etapas ao serem concluídas.
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
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Nome do fluxo..."
              className="h-9 text-sm max-w-xs"
            />
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={cancelEdit} className="gap-1">
                <X className="h-4 w-4" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1">
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </div>

          {/* Flow editor table */}
          <div className="border border-border/30 rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 gap-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/20">
              <div className="px-4 py-2.5">Etapa Atual</div>
              <div className="px-4 py-2.5">Ao Concluir →</div>
              <div className="px-4 py-2.5">Próxima Etapa</div>
            </div>
            {STAGE_OPTIONS.map(stage => {
              const color = getStageCircleColor(stage.key);
              const isDone = stage.key === "entrega";
              const nextKey = editConfig[stage.key] ?? NONE_VALUE;

              return (
                <div key={stage.key} className="grid grid-cols-3 gap-0 border-b border-border/10 hover:bg-accent/20 transition">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", color.border, isDone && color.bg)}>
                      {isDone && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <span className="text-sm">{stage.label}</span>
                  </div>
                  <div className="flex items-center px-4 py-3">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center px-4 py-3">
                    {isDone ? (
                      <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Etapa Final
                      </span>
                    ) : (
                      <Select value={nextKey} onValueChange={v => updateStageNext(stage.key, v)}>
                        <SelectTrigger className="h-8 text-xs w-44">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>— Nenhuma (final)</SelectItem>
                          {STAGE_OPTIONS.filter(s => s.key !== stage.key).map(s => {
                            const sc = getStageCircleColor(s.key);
                            return (
                              <SelectItem key={s.key} value={s.key}>
                                <span className="flex items-center gap-2">
                                  <span className={cn("h-3 w-3 rounded-full border-2 shrink-0", sc.border, s.key === "entrega" && sc.bg)} />
                                  {s.label}
                                </span>
                              </SelectItem>
                            );
                          })}
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
          if (editingId === flow.id) return null; // editing above
          const config = flow.flow_config as Record<string, string>;

          return (
            <div key={flow.id} className={cn(
              "border rounded-lg p-5 transition",
              flow.is_default ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/30"
            )}>
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

              {/* Flow visualization */}
              <div className="flex flex-wrap items-center gap-2">
                {STAGE_OPTIONS.map(stage => {
                  const color = getStageCircleColor(stage.key);
                  const isDone = stage.key === "entrega";
                  const nextKey = config[stage.key];
                  const isInFlow = !!nextKey || isDone || Object.values(config).includes(stage.key);

                  if (!isInFlow) return null;

                  return (
                    <div key={stage.key} className="flex items-center gap-2">
                      <div className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 transition text-xs",
                        isDone
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-border/40 bg-card/50"
                      )}>
                        <span className={cn(
                          "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                          color.border,
                          isDone && color.bg
                        )}>
                          {isDone && <Check className="h-2.5 w-2.5 text-white" />}
                        </span>
                        <span className="font-medium whitespace-nowrap">{stage.label}</span>
                      </div>
                      {nextKey && (
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
        💡 O fluxo marcado com ⭐ é o fluxo padrão aplicado quando uma etapa é marcada como "concluída". 
        A etapa "Entregue" é sempre a etapa final — quando alcançada, a tarefa é considerada concluída.
      </p>
    </div>
  );
}
