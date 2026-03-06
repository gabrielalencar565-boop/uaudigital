import { useState } from "react";
import { ArrowRight, Check, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PM_ACTIVE_STAGES, STAGE_FLOW_NEXT, getStageCircleColor } from "../pm-constants";

/**
 * Stage Flow Configuration panel.
 * Shows the current auto-advance flow: when a task's stage is marked "concluído",
 * it auto-advances to the next configured stage.
 */
export function PmStageFlowConfig() {
  const stages = PM_ACTIVE_STAGES;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          Fluxo de Etapas
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Quando uma etapa é marcada como concluída, a tarefa avança automaticamente para a próxima etapa configurada.
        </p>
      </div>

      {/* Flow visualization */}
      <div className="border border-border/30 rounded-lg p-6 bg-card/30">
        <h4 className="text-sm font-semibold mb-4">Fluxo Automático</h4>
        <div className="flex flex-wrap items-center gap-2">
          {stages.map((stage, idx) => {
            const color = getStageCircleColor(stage.key);
            const isDone = stage.key === "entrega";
            const nextKey = STAGE_FLOW_NEXT[stage.key];
            const isLast = !nextKey;

            return (
              <div key={stage.key} className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center gap-2 rounded-lg border px-4 py-3 transition",
                  isDone
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-border/40 bg-card/50 hover:bg-card/80"
                )}>
                  <span className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    color.border,
                    isDone && `${color.bg}`
                  )}>
                    {isDone && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="text-sm font-medium whitespace-nowrap">{stage.label}</span>
                </div>
                {!isLast && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail table */}
      <div className="border border-border/30 rounded-lg overflow-hidden">
        <div className="grid grid-cols-3 gap-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/20">
          <div className="px-4 py-2.5">Etapa Atual</div>
          <div className="px-4 py-2.5">Ao Concluir →</div>
          <div className="px-4 py-2.5">Próxima Etapa</div>
        </div>
        {stages.map(stage => {
          const color = getStageCircleColor(stage.key);
          const isDone = stage.key === "entrega";
          const nextKey = STAGE_FLOW_NEXT[stage.key];
          const nextStage = nextKey ? stages.find(s => s.key === nextKey) : null;
          const nextColor = nextKey ? getStageCircleColor(nextKey) : null;

          return (
            <div key={stage.key} className="grid grid-cols-3 gap-0 border-b border-border/10 hover:bg-accent/20 transition">
              <div className="flex items-center gap-2 px-4 py-3">
                <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", color.border, isDone && `${color.bg}`)}>
                  {isDone && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="text-sm">{stage.label}</span>
              </div>
              <div className="flex items-center px-4 py-3">
                {nextKey ? (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" /> Tarefa Concluída
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 px-4 py-3">
                {nextStage && nextColor ? (
                  <>
                    <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", nextColor.border, nextKey === "entrega" && `${nextColor.bg}`)}>
                      {nextKey === "entrega" && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <span className="text-sm">{nextStage.label}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        💡 O fluxo automático é aplicado quando você marca uma etapa como "concluída" dentro de uma tarefa ou subtarefa. 
        A etapa "Entregue" é a etapa final — quando alcançada, a tarefa é considerada concluída.
      </p>
    </div>
  );
}
