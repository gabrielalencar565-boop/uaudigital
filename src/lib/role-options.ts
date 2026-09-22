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

// ConfiguracoesPanel.tsx lets role_title be typed freely (not always picked from
// ROLE_OPTIONS above), so gating a feature on it needs to tolerate stray casing/whitespace
// instead of a strict `=== "Social Media"`.
export function isSocialMediaRole(roleTitle: string | null | undefined): boolean {
  return (roleTitle ?? "").trim().toLowerCase() === "social media";
}
