// Ready-made workflows an agency owner can start from. A template lists the stages that are ACTIVE (in order) and
// which stage follows which. Built-in stage keys (captacao, planejamento, design, edicao_videos, revisao, pdf,
// agendamento, entrega, alteracoes) keep their original behavior and are re-labelled; any other key is a custom
// generic stage created for the agency. Built-in stages a template doesn't use stay in the catalog, hidden, so old
// tasks keep resolving.

export type TemplateStage = { key: string; label: string; color?: string; kind?: "work" };

export type FlowTemplate = {
  id: string;
  name: string;
  audience: string;
  description: string;
  stages: TemplateStage[];
  /** stage key → next stage key (the flow graph) */
  next: Record<string, string>;
  note?: string;
  /** The agency's own setup, shown first and highlighted. */
  featured?: boolean;
};

export const BUILTIN_STAGE_KEYS = ["captacao", "planejamento", "design", "edicao_videos", "revisao", "pdf", "agendamento", "entrega", "alteracoes"] as const;

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "uau",
    name: "Modelo Uau",
    audience: "O fluxo que a Uau Digital usa hoje",
    description: "Captação e pauta, criação em paralelo (design e vídeo), revisão interna, cronograma com o cliente, agendamento e entrega. Alterações voltam para quem fez.",
    featured: true,
    stages: [
      { key: "captacao", label: "Captação" },
      { key: "planejamento", label: "Planejamento" },
      { key: "design", label: "Design" },
      { key: "edicao_videos", label: "Vídeo" },
      { key: "revisao", label: "Revisão" },
      { key: "pdf", label: "Cronograma" },
      { key: "agendamento", label: "Agendamento" },
      { key: "entrega", label: "Entregue" },
      { key: "alteracoes", label: "Alterações" },
    ],
    next: { captacao: "planejamento", planejamento: "revisao", design: "revisao", edicao_videos: "revisao", revisao: "pdf", pdf: "agendamento", agendamento: "entrega" },
  },
  {
    id: "agencia_social",
    name: "Agência de social media",
    audience: "Equipe com planejamento, design, vídeo e revisão",
    description: "Pauta, criação em paralelo (design e vídeo), revisão, aprovação do cliente em PDF e agendamento.",
    stages: [
      { key: "captacao", label: "Captação" },
      { key: "planejamento", label: "Planejamento" },
      { key: "design", label: "Design" },
      { key: "edicao_videos", label: "Vídeo" },
      { key: "revisao", label: "Revisão" },
      { key: "pdf", label: "PDF" },
      { key: "agendamento", label: "Agendamento" },
      { key: "entrega", label: "Entregue" },
      { key: "alteracoes", label: "Alterações" },
    ],
    next: { captacao: "planejamento", planejamento: "revisao", design: "revisao", edicao_videos: "revisao", revisao: "pdf", pdf: "agendamento", agendamento: "entrega" },
  },
  {
    id: "social_solo",
    name: "Social media solo",
    audience: "Quem faz tudo sozinho",
    description: "Enxuto: pauta, criação, aprovação do cliente e agendamento. Sem revisão interna nem etapas em paralelo.",
    stages: [
      { key: "planejamento", label: "Pauta" },
      { key: "design", label: "Criação" },
      { key: "pdf", label: "Aprovação do cliente" },
      { key: "agendamento", label: "Agendamento" },
      { key: "entrega", label: "Publicado" },
      { key: "alteracoes", label: "Ajustes" },
    ],
    next: { planejamento: "design", design: "pdf", pdf: "agendamento", agendamento: "entrega" },
  },
  {
    id: "trafego",
    name: "Gestor de tráfego",
    audience: "Campanhas pagas e relatórios",
    description: "Do onboarding das contas ao relatório: acessos, estratégia, criativos, campanhas no ar, otimização e prestação de contas.",
    stages: [
      { key: "onboarding", label: "Onboarding e acessos", color: "sky" },
      { key: "estrategia", label: "Estratégia", color: "violet" },
      { key: "criativos", label: "Criativos", color: "pink" },
      { key: "subir_campanhas", label: "Subir campanhas", color: "orange" },
      { key: "otimizacao", label: "Otimização", color: "teal" },
      { key: "relatorio", label: "Relatório", color: "indigo" },
      { key: "entrega", label: "Concluído" },
    ],
    next: { onboarding: "estrategia", estrategia: "criativos", criativos: "subir_campanhas", subir_campanhas: "otimizacao", otimizacao: "relatorio", relatorio: "entrega" },
    note: "Otimização e relatório costumam se repetir todo mês; a repetição automática chega junto com as automações.",
  },
  {
    id: "producao_video",
    name: "Produtora de vídeo",
    audience: "Roteiro, gravação e edição",
    description: "Roteiro, captação, edição, revisão e entrega ao cliente.",
    stages: [
      { key: "planejamento", label: "Roteiro" },
      { key: "captacao", label: "Captação" },
      { key: "edicao_videos", label: "Edição" },
      { key: "revisao", label: "Revisão" },
      { key: "entrega", label: "Entrega" },
    ],
    next: { planejamento: "captacao", captacao: "edicao_videos", edicao_videos: "revisao", revisao: "entrega" },
  },
  {
    id: "em_branco",
    name: "Em branco",
    audience: "Monte do seu jeito",
    description: "Três colunas simples (A fazer, Fazendo, Feito) para você ir adicionando e renomeando as etapas.",
    stages: [
      { key: "a_fazer", label: "A fazer", color: "zinc" },
      { key: "fazendo", label: "Fazendo", color: "blue" },
      { key: "entrega", label: "Feito" },
    ],
    next: { a_fazer: "fazendo", fazendo: "entrega" },
  },
];
