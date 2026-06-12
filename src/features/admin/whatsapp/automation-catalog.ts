/**
 * Catálogo de gatilhos disponíveis para a Central de Automações WhatsApp.
 * Para adicionar um novo gatilho no futuro: adicione entrada aqui +
 * (se for evento) crie um trigger no banco que chame whatsapp_dispatch_event,
 * ou (se for horário) adicione o handler em supabase/functions/whatsapp-dispatch/index.ts → runScheduledAutomation.
 */
export type TriggerType = "event" | "schedule";

export type TriggerVar =
  | "nome"
  | "primeiro_nome"
  | "tarefa"
  | "cliente"
  | "prazo"
  | "xp"
  | "nivel"
  | "ranking"
  | "tarefas_do_dia"
  | "tarefas_atrasadas"
  | "tarefas_concluidas"
  | "total_tarefas_dia";

export type TriggerDef = {
  key: string;
  label: string;
  description: string;
  type: TriggerType;
  category: "tarefas" | "xp" | "resumo";
  vars: TriggerVar[];
  defaultTime?: string;
};

export const TRIGGERS: TriggerDef[] = [
  // Eventos — Tarefas
  { key: "task_assigned", label: "Nova tarefa atribuída", description: "Quando uma tarefa é atribuída a um colaborador.", type: "event", category: "tarefas",
    vars: ["nome", "primeiro_nome", "tarefa", "cliente", "prazo"] },
  { key: "task_completed", label: "Tarefa concluída", description: "Quando uma tarefa é marcada como concluída.", type: "event", category: "tarefas",
    vars: ["nome", "primeiro_nome", "tarefa", "cliente", "prazo"] },
  { key: "task_overdue", label: "Tarefa atrasada", description: "Quando uma tarefa fica vencida sem ser concluída.", type: "event", category: "tarefas",
    vars: ["nome", "primeiro_nome", "tarefa", "cliente", "prazo"] },

  // Eventos — XP
  { key: "xp_gain", label: "Ganho de XP", description: "Toda vez que o colaborador recebe XP.", type: "event", category: "xp",
    vars: ["nome", "primeiro_nome", "xp", "ranking"] },
  { key: "xp_level_up", label: "Subiu de nível", description: "Quando o colaborador sobe para um nível superior.", type: "event", category: "xp",
    vars: ["nome", "primeiro_nome", "nivel", "xp"] },
  { key: "xp_top3", label: "Entrou no Top 3", description: "Quando o colaborador entra no Top 3 mensal.", type: "event", category: "xp",
    vars: ["nome", "primeiro_nome", "ranking", "xp"] },
  { key: "xp_first", label: "Assumiu 1º lugar", description: "Quando o colaborador assume o 1º lugar do mês.", type: "event", category: "xp",
    vars: ["nome", "primeiro_nome", "ranking", "xp"] },

  // Horários
  { key: "deadline_today", label: "Prazo hoje", description: "Lembrete diário para tarefas que vencem hoje.", type: "schedule", category: "tarefas",
    vars: ["nome", "primeiro_nome", "tarefa", "cliente", "prazo"], defaultTime: "08:00" },
  { key: "deadline_tomorrow", label: "Prazo amanhã", description: "Lembrete diário para tarefas que vencem amanhã.", type: "schedule", category: "tarefas",
    vars: ["nome", "primeiro_nome", "tarefa", "cliente", "prazo"], defaultTime: "17:00" },
  { key: "deadline_overdue", label: "Prazo atrasado", description: "Lembrete diário para tarefas vencidas há 1 dia ou mais.", type: "schedule", category: "tarefas",
    vars: ["nome", "primeiro_nome", "tarefa", "cliente", "prazo"], defaultTime: "09:00" },
  { key: "daily_agenda", label: "Agenda diária", description: "Resumo matinal com as tarefas do dia do colaborador.", type: "schedule", category: "resumo",
    vars: ["nome", "primeiro_nome", "tarefas_do_dia", "total_tarefas_dia"], defaultTime: "08:30" },
  { key: "daily_summary", label: "Resumo do dia", description: "Resumo ao fim do dia com tarefas concluídas e atrasadas.", type: "schedule", category: "resumo",
    vars: ["nome", "primeiro_nome", "tarefas_concluidas", "tarefas_atrasadas"], defaultTime: "19:00" },
  { key: "weekly_summary", label: "Resumo semanal", description: "Resumo das tarefas concluídas na semana.", type: "schedule", category: "resumo",
    vars: ["nome", "primeiro_nome", "tarefas_concluidas"], defaultTime: "18:00" },
  { key: "performance_report", label: "Relatório de desempenho", description: "Relatório de desempenho enviado periodicamente.", type: "schedule", category: "xp",
    vars: ["nome", "primeiro_nome", "ranking", "xp"], defaultTime: "09:00" },
];

export function getTrigger(key: string): TriggerDef | undefined {
  return TRIGGERS.find((t) => t.key === key);
}

export const WEEKDAYS = [
  { value: 0, short: "D", label: "Domingo" },
  { value: 1, short: "S", label: "Segunda" },
  { value: 2, short: "T", label: "Terça" },
  { value: 3, short: "Q", label: "Quarta" },
  { value: 4, short: "Q", label: "Quinta" },
  { value: 5, short: "S", label: "Sexta" },
  { value: 6, short: "S", label: "Sábado" },
];

export type Audience = "assignee" | "all_team" | "admins" | "group";
export const AUDIENCES: { value: Audience; label: string; description: string }[] = [
  { value: "assignee", label: "Colaborador relacionado", description: "Quem é responsável pelo evento (ex.: dono da tarefa)." },
  { value: "all_team", label: "Toda a equipe", description: "Todos com WhatsApp habilitado." },
  { value: "admins", label: "Apenas admins", description: "Somente usuários com papel admin." },
  { value: "group", label: "Grupo do WhatsApp", description: "Envia para um grupo do WhatsApp (informe o ID do grupo)." },
];

const SAMPLE_VARS: Record<TriggerVar, string> = {
  nome: "Gabriel Silva",
  primeiro_nome: "Gabriel",
  tarefa: "Editar vídeo institucional",
  cliente: "Acme",
  prazo: "27/06/2026",
  xp: "150",
  nivel: "5",
  ranking: "1º Lugar no Ranking Mensal",
  tarefas_do_dia: "• Editar vídeo · Acme · 14h\n• Postar reels · Beta · 18h",
  tarefas_atrasadas: "• Aprovar legenda (venceu em 10/06/2026)",
  tarefas_concluidas: "• Editar vídeo\n• Postar reels",
  total_tarefas_dia: "2",
};

export function renderTemplate(template: string, available: TriggerVar[]): string {
  if (!template) return "";
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
    if (!available.includes(k as TriggerVar)) return "";
    return SAMPLE_VARS[k as TriggerVar] ?? "";
  });
}
