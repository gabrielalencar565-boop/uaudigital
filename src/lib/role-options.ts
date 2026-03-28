/**
 * Cargos predefinidos que se integram com as etapas do fluxo de trabalho.
 *
 * Mapeamento de etapas:
 *  - Social Media  → Planejamento, PDF, Alterações, Agendamento
 *  - Designer      → Design
 *  - Editor de Vídeo → Captação, Edição de Vídeo (Vídeo)
 */
export const ROLE_OPTIONS = [
  { value: "Social Media", label: "Social Media" },
  { value: "Designer", label: "Designer" },
  { value: "Editor de Vídeo", label: "Editor de Vídeo" },
] as const;

export type RoleOptionValue = (typeof ROLE_OPTIONS)[number]["value"];
