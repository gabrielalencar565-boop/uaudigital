// Texts of the client-approval link preview (WhatsApp & social). The same templates are applied by the Vercel
// middleware (middleware.ts) when a link-preview bot opens the link; keep the defaults in sync with it.
export const DEFAULT_LINK_PREVIEW_TITLE = "Conteúdos - {cliente} | {mes}/{ano}";
export const DEFAULT_LINK_PREVIEW_DESCRIPTION = "Confira e aprove as publicações programadas para {cliente} — ciclo {mes}/{ano}.";
export const LINK_PREVIEW_VARIABLES = [
  { token: "{cliente}", label: "Nome do cliente" },
  { token: "{mes}", label: "Mês do ciclo" },
  { token: "{ano}", label: "Ano do ciclo" },
] as const;

export function renderLinkPreviewTemplate(template: string, vars: { cliente: string; mes: string; ano: string }) {
  return template.replace(/\{cliente\}/g, vars.cliente).replace(/\{mes\}/g, vars.mes).replace(/\{ano\}/g, vars.ano);
}
