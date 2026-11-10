import "server-only";

/**
 * Envia o lead para o funil comercial do Fluxo, pelo formulário público do CRM
 * (a mesma porta da página appfluxo.app.br/f/<slug>). Não precisa de chave:
 * só do identificador (slug) de um formulário publicado no Fluxo.
 *
 * O formulário no Fluxo precisa ter campos com estes nomes EXATOS:
 *   "Seu nome"  → Salvar no lead: Nome       (obrigatório)
 *   "WhatsApp"  → Salvar no lead: WhatsApp   (obrigatório)
 *   "Instagram" → Salvar no lead: Instagram
 *   "Origem"    → Não salvar no lead
 *   "Resumo"    → Não salvar no lead (texto longo)
 *
 * Nunca trava o teste: se o Fluxo não responder, só registra no log.
 */

export const CAMPOS_FLUXO = {
  nome: "Seu nome",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  origem: "Origem",
  resumo: "Resumo",
} as const;

const URL_PADRAO = "https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/public-formulario";

export type EnvioFluxo = {
  nome: string;
  whatsapp: string; // só dígitos, com ou sem 55
  instagram?: string | null;
  origem: string;
  resumo: string;
};

export function fluxoConfigurado() {
  return Boolean(process.env.FLUXO_FORM_SLUG);
}

/** Telefone no formato que o Fluxo reconhece: (11) 98765-4321. */
function telefone(digitos: string) {
  const d = digitos.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

export async function enviarParaFluxo(dados: EnvioFluxo): Promise<boolean> {
  const slug = process.env.FLUXO_FORM_SLUG;
  if (!slug) return false;
  const answers: Record<string, string> = {
    [CAMPOS_FLUXO.nome]: dados.nome,
    [CAMPOS_FLUXO.whatsapp]: telefone(dados.whatsapp),
    [CAMPOS_FLUXO.origem]: dados.origem,
    [CAMPOS_FLUXO.resumo]: dados.resumo.slice(0, 2900),
  };
  if (dados.instagram) answers[CAMPOS_FLUXO.instagram] = `@${dados.instagram.replace(/^@+/, "")}`;

  try {
    const res = await fetch(process.env.FLUXO_FORM_URL || URL_PADRAO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, action: "submit", answers }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[fluxo] Formulário recusou o lead (${res.status}):`, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (erro) {
    console.error("[fluxo] Falha ao enviar lead para o Fluxo:", (erro as Error).message);
    return false;
  }
}
