import { createContext, useContext } from "react";
import type { Activity, ClientTask, ComercialClient, Lead, Pipeline, PipelineKey, Stage } from "./lib/rules";
import type { TeamMember } from "./hooks/use-comercial";

export type ComercialView = "overview" | "funil" | "leads" | "acts" | "chat" | "chat_wa" | "chat_ig" | "chat_em" | "autos" | "forms" | "lib" | "onb" | "cfg";

export interface ComercialCtx {
  /** etapas do funil escolhido (Serviços UAU ou Produtos digitais) */
  stages: Stage[];
  /** leads do funil escolhido */
  leads: Lead[];
  /** todas as etapas, dos dois funis (para formulários, automações e a gaveta do lead) */
  allStages: Stage[];
  /** todos os leads, dos dois funis (para achar duplicados) */
  allLeads: Lead[];
  pipelines: Pipeline[];
  /** funil escolhido no seletor */
  pipeline: Pipeline | undefined;
  setPipeline: (key: PipelineKey) => void;
  /** nome da etapa com o funil na frente ("Produtos digitais · Novo lead") */
  stageLabel: (id: string) => string;
  acts: Activity[];
  clients: ComercialClient[];
  clientTasks: ClientTask[];
  team: TeamMember[];
  contacted: Set<string>;
  today: string;
  stageOf: (id: string) => Stage | undefined;
  memberOf: (id: string | null | undefined) => TeamMember | undefined;
  leadOf: (id: string) => Lead | undefined;
  /** abre a gaveta do lead (null fecha) */
  openLead: (id: string | null) => void;
  /** abre a gaveta do onboarding do cliente (null fecha) */
  openClient: (id: string | null) => void;
  /** abre o formulário de próxima ação, para um lead ou livre */
  newActivity: (leadId?: string) => void;
  newLead: () => void;
  /** move o lead de etapa; ganho e perdido pedem os dados antes */
  moveLead: (lead: Lead, stageId: string) => void;
  goto: (view: ComercialView) => void;
  /** abre a conversa daquele número em Conversas, dentro do próprio Fluxo */
  openChat: (phone: string | null | undefined) => void;
}

export const ComercialContext = createContext<ComercialCtx | null>(null);

export function useComercial(): ComercialCtx {
  const ctx = useContext(ComercialContext);
  if (!ctx) throw new Error("useComercial precisa estar dentro do CRM comercial");
  return ctx;
}
