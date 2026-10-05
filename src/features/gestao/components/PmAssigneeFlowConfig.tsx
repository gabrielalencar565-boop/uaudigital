import { useState, useMemo } from "react";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { Users, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PM_ACTIVE_STAGES, getStageCircleColor } from "../pm-constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { StageAssignees } from "./PmStageFlowConfig";
import { useStageFlows } from "./PmStageFlowConfig";

const sb = supabase as any;

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

// Stages that are editable independently
// planejamento controls pdf, agendamento
const LINKED_STAGES = ["pdf", "agendamento"] as const;
// A revisão vira 3 colunas virtuais, uma por origem — planejamento, design e vídeo têm
// revisor próprio (Head de Conteúdo / Diretor de Arte / Diretor de Vídeo), cada um com seu
// responsável fixo por cliente. A coluna genérica "Revisão" (chave 'revisao' pura) some daqui
// porque nenhuma transição resolve mais pra ela (ver resolveAssigneeStageKey em
// PmStageFlowConfig.tsx) — configurá-la aqui não teria efeito nenhum.
const VIRTUAL_REVIEW_COLUMNS: Record<string, { key: string; label: string; insertAfter: string }> = {
  revisao_pauta: { key: "revisao_pauta", label: "Revisão (Planejamento)", insertAfter: "planejamento" },
  revisao_design: { key: "revisao_design", label: "Revisão (Design)", insertAfter: "design" },
  revisao_video: { key: "revisao_video", label: "Revisão (Vídeo)", insertAfter: "edicao_videos" },
};
// Computed per render: the agency's stages (renamed/hidden/custom) are applied at runtime.
const getEditableStages = (): { key: string; label: string }[] => {
  const base = PM_ACTIVE_STAGES.filter(
    s => !LINKED_STAGES.includes(s.key as any) && s.key !== "entrega" && s.key !== "revisao"
  );
  let result: { key: string; label: string }[] = [];
  for (const stage of base) {
    result.push(stage);
    const virtual = Object.values(VIRTUAL_REVIEW_COLUMNS).find(v => v.insertAfter === stage.key);
    if (virtual) result.push({ key: virtual.key, label: virtual.label });
  }
  return result;
};

export function PmAssigneeFlowConfig() {
  const qc = useQueryClient();
  const flowsQ = useStageFlows();
  const defaultFlow = useMemo(() => {
    const flows = flowsQ.data ?? [];
    return flows.find(f => f.is_default) ?? flows[0];
  }, [flowsQ.data]);

  const [localAssignees, setLocalAssignees] = useState<StageAssignees | null>(null);
  const [dirty, setDirty] = useState(false);

  // Initialize from default flow
  const assignees: StageAssignees = useMemo(() => {
    if (localAssignees) return localAssignees;
    return (defaultFlow?.stage_assignees ?? {}) as StageAssignees;
  }, [localAssignees, defaultFlow]);

  const clientsQ = useQuery({
    queryKey: ["pm_clients_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .eq("is_freelancer_sentinel", false)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const membersQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("user_id, display_name, avatar_url").eq("is_active", true);
      if (error) throw error;
      return (data ?? []).map(tm => ({ ...tm, avatar_url: normalizeAvatarUrl(tm.avatar_url) ?? null }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (stageAssignees: StageAssignees) => {
      if (!defaultFlow) throw new Error("Nenhum fluxo padrão encontrado");
      const { error } = await sb.from("pm_stage_flows").update({
        stage_assignees: stageAssignees,
        updated_at: new Date().toISOString(),
      }).eq("id", defaultFlow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_stage_flows"] });
      setDirty(false);
      toast.success("Responsáveis salvos!");
    },
    onError: () => toast.error("Erro ao salvar responsáveis"),
  });

  const setAssignee = (stageKey: string, clientId: string, userId: string | null | undefined) => {
    setLocalAssignees(prev => {
      const base = prev ?? { ...assignees };
      const copy = { ...base };

      const applyToStage = (sk: string) => {
        if (!copy[sk]) copy[sk] = {};
        copy[sk] = { ...copy[sk] };
        if (userId === undefined) {
          // Remove config
          delete copy[sk][clientId];
          if (Object.keys(copy[sk]).length === 0) delete copy[sk];
        } else {
          copy[sk][clientId] = userId;
        }
      };

      applyToStage(stageKey);

      // If planejamento, also apply to revisão, pdf, agendamento
      if (stageKey === "planejamento") {
        LINKED_STAGES.forEach(sk => applyToStage(sk));
      }

      return copy;
    });
    setDirty(true);
  };

  const handleSave = () => {
    if (localAssignees) saveMutation.mutate(localAssignees);
  };

  if (!defaultFlow) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Crie um fluxo de etapas padrão primeiro para configurar os responsáveis.
      </div>
    );
  }

  const clients = clientsQ.data ?? [];
  const members = membersQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Responsáveis por Cliente
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Defina quem é responsável fixo em cada etapa para cada cliente. Planejamento, PDF e Agendamento compartilham o mesmo responsável. Cada revisão (<strong className="text-foreground">Planejamento</strong>, <strong className="text-foreground">Design</strong> e <strong className="text-foreground">Vídeo</strong>) tem seu próprio responsável.
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
            <Save className="h-4 w-4" /> Salvar
          </Button>
        )}
      </div>

      <div className="border border-border/30 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 border-b border-border/20">
                <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider text-muted-foreground min-w-[180px] sticky left-0 bg-muted/30 z-10">
                  Cliente
                </th>
                {getEditableStages().map(stage => {
                  // As 3 colunas virtuais de revisão reusam a cor de 'revisao'
                  const color = getStageCircleColor(stage.key in VIRTUAL_REVIEW_COLUMNS ? "revisao" : stage.key);
                  const isLinked = stage.key === "planejamento";
                  return (
                    <th key={stage.key} className="text-center px-3 py-2.5 font-semibold uppercase tracking-wider text-muted-foreground min-w-[160px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={cn("h-3 w-3 rounded-full border-2 shrink-0", color.border)} />
                        <span>{stage.label}</span>
                      </div>
                      {isLinked && (
                        <span className="text-[9px] font-normal normal-case text-muted-foreground/60 block mt-0.5">
                          = PDF, Agendamento
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} className="border-b border-border/10 hover:bg-accent/10 transition">
                  <td className="px-4 py-2.5 font-medium text-sm sticky left-0 bg-background z-10 min-w-[180px]">
                    {client.name}
                  </td>
                  {getEditableStages().map(stage => {
                    const rawVal = assignees[stage.key]?.[client.id];
                    const currentVal = Array.isArray(rawVal) ? (rawVal[0] ?? null) : rawVal;
                    const hasConfig = rawVal !== undefined;
                    const member = currentVal ? members.find(m => m.user_id === currentVal) : null;

                    return (
                      <td key={stage.key} className="px-2 py-2 text-center">
                        <Select
                          value={hasConfig ? (currentVal ?? "__none__") as string : "__unset__"}
                          onValueChange={(v) => {
                            if (v === "__unset__") {
                              setAssignee(stage.key, client.id, undefined);
                            } else if (v === "__none__") {
                              setAssignee(stage.key, client.id, null);
                            } else {
                              setAssignee(stage.key, client.id, v);
                            }
                          }}
                        >
                          <SelectTrigger className={cn(
                            "h-8 text-xs w-full",
                            hasConfig && currentVal ? "border-primary/30" : ""
                          )}>
                            <SelectValue placeholder="—">
                              {hasConfig ? (
                                currentVal === null ? (
                                  <span className="text-muted-foreground">Sem fixo</span>
                                ) : member ? (
                                  <div className="flex items-center gap-1.5">
                                    <Avatar className="h-4 w-4">
                                      <AvatarImage src={member.avatar_url ?? undefined} />
                                      <AvatarFallback className="text-[6px]">{initials(member.display_name)}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{member.display_name.split(" ")[0]}</span>
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unset__" className="text-xs text-muted-foreground">Sem configuração</SelectItem>
                            <SelectItem value="__none__" className="text-xs text-muted-foreground">Sem pessoa fixa</SelectItem>
                            {members.map(m => (
                              <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={m.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-[7px]">{initials(m.display_name)}</AvatarFallback>
                                  </Avatar>
                                  {m.display_name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={getEditableStages().length + 1} className="text-center py-8 text-sm text-muted-foreground">
                    Nenhum cliente ativo encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 Ao concluir uma etapa e avançar para a próxima, o responsável fixo definido aqui será automaticamente atribuído.
      </p>
    </div>
  );
}
