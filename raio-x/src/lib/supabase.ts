import "server-only";

/**
 * Acesso ao Supabase pela API REST (PostgREST), só no servidor.
 * Usa a SUPABASE_SERVICE_ROLE_KEY, que nunca vai para o navegador.
 */

export type LeadContact = {
  id: string;
  nome: string;
  whatsapp: string;
  instagram: string | null;
  consentimento: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  user_agent: string | null;
  status: "iniciado";
};

export type LeadResult = {
  nota_geral: number;
  nota_objetivo: number;
  nota_diagnostico: number;
  nota_concorrentes: number;
  nota_conteudo: number;
  nota_apresentacao: number;
  nota_valor: number;
  nivel: string;
  gargalo: string;
  respostas: unknown;
  status: "concluido";
  concluido_em: string;
};

/** Linha completa da tabela (as notas ficam vazias até a pessoa terminar). */
export type LeadRow = Omit<LeadContact, "status"> &
  Partial<Omit<LeadResult, "status">> & { created_at?: string; status: "iniciado" | "concluido" };

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured() {
  return config() !== null;
}

function headers(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function insertLead(row: LeadContact): Promise<void> {
  const c = config();
  if (!c) throw new Error("Supabase não configurado");
  const res = await fetch(`${c.url}/rest/v1/leads`, {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "return=minimal" },
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}

/** Completa o lead com o resultado. Devolve false se o id não existir. */
export async function updateLead(id: string, patch: LeadResult): Promise<boolean> {
  const c = config();
  if (!c) throw new Error("Supabase não configurado");
  const res = await fetch(`${c.url}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers(c.key), Prefer: "return=representation" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as unknown[];
  return rows.length > 0;
}

export async function listLeads(limit = 5000): Promise<LeadRow[]> {
  const c = config();
  if (!c) throw new Error("Supabase não configurado");
  const res = await fetch(`${c.url}/rest/v1/leads?select=*&order=created_at.desc&limit=${limit}`, {
    headers: headers(c.key),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return (await res.json()) as LeadRow[];
}
